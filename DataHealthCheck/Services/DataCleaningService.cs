using Microsoft.EntityFrameworkCore;
using Microsoft.ML;
using Microsoft.ML.Data;
using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;

namespace DataHealthCheck.Services
{
    public class DataCleaningService : IDataCleaningService
    {
        private readonly MLContext _mlContext;

        public DataCleaningService()
        {
            _mlContext = new MLContext(seed: 42);
        }

        public class CleaningResult
        {
            public string CleanedFilePath { get; set; } = string.Empty;
            public List<CleaningOperation> Operations { get; set; } = new();
            public Dictionary<string, ColumnCleaningStats> ColumnStats { get; set; } = new();
            public QualityReport Report { get; set; } = new();
        }

        public class ColumnCleaningStats
        {
            public int OriginalCount { get; set; }
            public int CleanedCount { get; set; }
            public int MissingValuesImputed { get; set; }
            public int DuplicatesRemoved { get; set; }
            public int OutliersHandled { get; set; }
            public int FormatIssuesFixed { get; set; }
        }

        public CleaningResult CleanDatasetGeneric(string inputFilePath, string outputFilePath)
        {
            var cleaningOps = new List<CleaningOperation>();
            var columnStats = new Dictionary<string, ColumnCleaningStats>();

            try
            {
                // Single-pass: load data + detect structure (no separate pre-analysis pass)
                var (columns, data, totalRows) = LoadDataWithStructureFast(inputFilePath);

                // Nettoyage par colonne
                var cleanedData = CleanColumns(columns, data, cleaningOps, columnStats);

                // Nettoyage des lignes (doublons)
                cleanedData = CleanDuplicateRows(cleanedData, cleaningOps, columnStats);

                // Sauvegarde du résultat
                SaveCleanedData(cleanedData, columns, outputFilePath);

                // Rapport rapide
                var report = new QualityReport
                {
                    OriginalRowCount = totalRows,
                    CleanedRowCount = columnStats.Any() ? columnStats.First().Value.CleanedCount : cleanedData.Count,
                    CleaningDate = DateTime.UtcNow,
                    OperationsApplied = cleaningOps
                };
                report.TotalMissingImputed = columnStats.Sum(s => s.Value.MissingValuesImputed);
                report.TotalDuplicatesRemoved = columnStats.Any() ? columnStats.First().Value.DuplicatesRemoved : 0;
                report.TotalOutliersHandled = columnStats.Sum(s => s.Value.OutliersHandled);
                report.TotalFormatIssuesFixed = columnStats.Sum(s => s.Value.FormatIssuesFixed);

                return new CleaningResult
                {
                    CleanedFilePath = outputFilePath,
                    Operations = cleaningOps,
                    ColumnStats = columnStats,
                    Report = report
                };
            }
            catch (Exception ex)
            {
                throw new Exception($"Erreur lors du nettoyage: {ex.Message}", ex);
            }
        }

        private PreCleaningAnalysis AnalyzeDatasetBeforeCleaning(string filePath)
        {
            var analysis = new PreCleaningAnalysis();

            using var reader = new StreamReader(filePath);
            var header = reader.ReadLine();
            if (string.IsNullOrEmpty(header)) return analysis;

            var separator = DetectSeparator(header);
            analysis.ColumnNames = header.Split(separator)
                .Select(c => c.Trim().Trim('"', '\''))
                .ToArray();

            // Lecture d'échantillon pour analyse
            var sampleData = new List<string[]>();
            for (int i = 0; i < 1000 && !reader.EndOfStream; i++)
            {
                var line = reader.ReadLine();
                if (!string.IsNullOrEmpty(line))
                    sampleData.Add(ParseCsvLine(line, separator));
            }

            analysis.SampleData = sampleData;
            analysis.TotalRows = CountTotalRows(filePath);

            return analysis;
        }

        // Fast single-pass loader: reads file once, collects samples, detects types in parallel
        private (List<ColumnInfo> columns, List<Dictionary<string, string>> data, int totalRows)
            LoadDataWithStructureFast(string filePath)
        {
            var columns = new List<ColumnInfo>();
            var data = new List<Dictionary<string, string>>();

            using var reader = new StreamReader(filePath, System.Text.Encoding.UTF8, true, 65536);
            var header = reader.ReadLine();
            if (string.IsNullOrEmpty(header))
                return (columns, data, 0);

            var separator = DetectSeparator(header);
            var colCount = 0;
            foreach (var rawName in header.Split(separator))
            {
                columns.Add(new ColumnInfo
                {
                    Name = rawName.Trim().Trim('"', '\''),
                    Position = colCount++,
                    DataType = "Unknown",
                    Samples = new List<string>(200) // pre-alloc
                });
            }

            // Use a fixed limit of 5000 rows for fast interactive cleaning
            const int MAX_ROWS = 5000;
            const int SAMPLE_LIMIT = 200;

            int rowCount = 0;
            data.Capacity = MAX_ROWS;

            while (!reader.EndOfStream && rowCount < MAX_ROWS)
            {
                var line = reader.ReadLine();
                if (string.IsNullOrEmpty(line)) continue;

                var values = ParseCsvLine(line, separator);
                var row = new Dictionary<string, string>(columns.Count);

                for (int i = 0; i < columns.Count; i++)
                {
                    var col = columns[i];
                    var value = i < values.Length ? values[i].Trim().Trim('"', '\'') : "";
                    row[col.Name] = value;
                    if (rowCount < SAMPLE_LIMIT)
                        col.Samples.Add(value);
                }

                data.Add(row);
                rowCount++;
            }

            // Parallel type detection on samples
            Parallel.ForEach(columns, column =>
            {
                column.DataType = DetectColumnDataType(column.Samples);
                column.MissingCount = column.Samples.Count(v => IsMissingValue(v));
                column.UniqueCount = column.Samples.Where(v => !IsMissingValue(v)).Distinct().Count();
            });

            return (columns, data, rowCount);
        }

        // Legacy method kept to avoid breaking other callers
        private (List<ColumnInfo> columns, List<Dictionary<string, string>> data)
            LoadDataWithStructure(string filePath)
        {
            var (cols, data, _) = LoadDataWithStructureFast(filePath);
            return (cols, data);
        }

        private List<Dictionary<string, string>> CleanColumns(
            List<ColumnInfo> columns,
            List<Dictionary<string, string>> data,
            List<CleaningOperation> operations,
            Dictionary<string, ColumnCleaningStats> stats)
        {
            var cleanedData = new List<Dictionary<string, string>>(data.Count);

            // Pré-calcul des statistiques par colonne
            var columnAnalyses = new ConcurrentDictionary<string, ColumnAnalysis>();
            var concurrentStats = new ConcurrentDictionary<string, ColumnCleaningStats>();

            Parallel.ForEach(columns, column =>
            {
                var analysis = AnalyzeColumnForCleaning(data, column);
                columnAnalyses[column.Name] = analysis;

                // Initialisation des stats avec ConcurrentDictionary
                concurrentStats[column.Name] = new ColumnCleaningStats
                {
                    OriginalCount = data.Count,
                    CleanedCount = data.Count
                };
            });

            // Copier les stats concurrentes vers le dictionnaire normal pour la suite
            foreach (var kvp in concurrentStats)
            {
                stats[kvp.Key] = kvp.Value;
            }

            // Nettoyage ligne par ligne
            foreach (var row in data)
            {
                var cleanedRow = new Dictionary<string, string>(row);

                foreach (var column in columns)
                {
                    // sécuriser l'accès à la valeur
                    /* string originalValue;
                     if (!row.TryGetValue(column.Name, out originalValue))
                     {
                         originalValue = "";
                     }*/
                    string? originalValue;
                    if (!row.TryGetValue(column.Name, out originalValue) || originalValue is null)
                    {
                        originalValue = string.Empty;
                    }


                    var cleanedValue = CleanValue(
                        originalValue,
                        column,
                        columnAnalyses[column.Name],
                        operations,
                        stats[column.Name]);

                    if (cleanedValue != originalValue)
                    {
                        cleanedRow[column.Name] = cleanedValue;
                    }
                }

                cleanedData.Add(cleanedRow);
            }


            return cleanedData;
        }

        private ColumnAnalysis AnalyzeColumnForCleaning(List<Dictionary<string, string>> data, ColumnInfo column)
        {
            var analysis = new ColumnAnalysis
            {
                ColumnName = column.Name,
                DataType = column.DataType
            };

            var values = data.Select(r =>
                    r.ContainsKey(column.Name) ? r[column.Name] : "")
                .Where(v => !IsMissingValue(v))
                .ToList();

            if (!values.Any()) return analysis;

            switch (column.DataType)
            {
                case "Integer":
                    var intValues = ExtractIntegerValues(values);
                    if (intValues.Any())
                    {
                        analysis.NumericStats = CalculateNumericStats(intValues.Select(d => (double)d).ToArray());
                        analysis.MostFrequent = CalculateMostFrequent(values);
                        analysis.IsSkewed = IsDistributionSkewed(intValues.Select(d => (double)d).ToArray());
                    }
                    break;

                case "Decimal":
                    var decValues = ExtractDecimalValues(values);
                    if (decValues.Any())
                    {
                        analysis.NumericStats = CalculateNumericStats(decValues.Select(d => (double)d).ToArray());
                        analysis.MostFrequent = CalculateMostFrequent(values);
                        analysis.IsSkewed = IsDistributionSkewed(decValues.Select(d => (double)d).ToArray());
                    }
                    break;

                case "String":
                    analysis.MostFrequent = CalculateMostFrequent(values);
                    analysis.UniqueValues = values.Distinct().Count();
                    analysis.ValueDistribution = CalculateValueDistribution(values);
                    break;

                case "DateTime":
                case "Boolean":
                    analysis.MostFrequent = CalculateMostFrequent(values);
                    break;
            }

            return analysis;
        }

        private string CleanValue(string value, ColumnInfo column, ColumnAnalysis analysis,
            List<CleaningOperation> operations, ColumnCleaningStats stats)
        {
            // 1. Valeurs manquantes
            if (IsMissingValue(value))
            {
                var imputedValue = ImputeMissingValue(column, analysis);
                if (imputedValue != value)
                {
                    operations.Add(new CleaningOperation
                    {
                        Type = "MissingImputation",
                        Column = column.Name,
                        Method = GetImputationMethod(column.DataType, analysis),
                        Value = imputedValue
                    });
                    stats.MissingValuesImputed++;
                    return imputedValue;
                }
            }

            // 2. Outliers pour les données numériques
            //if ((column.DataType == "Integer" || column.DataType == "Decimal") &&
            //    !string.IsNullOrEmpty(value) )
            //{
            //    if (IsOutlier(value, column.DataType, analysis.NumericStats ))
            //    {
            //        var correctedValue = HandleOutlier(value, column.DataType, analysis);
            //        operations.Add(new CleaningOperation
            //        {
            //            Type = "OutlierCorrection",
            //            Column = column.Name,
            //            Method = "IQR",
            //            OriginalValue = value,
            //            CorrectedValue = correctedValue
            //        });
            //        stats.OutliersHandled++;
            //        return correctedValue;
            //    }
            //}
            // 2. Outliers pour les données numériques
            if ((column.DataType == "Integer" || column.DataType == "Decimal") &&
                !string.IsNullOrEmpty(value) &&
                analysis.NumericStats != null)          // <-- nouveau test
            {
                if (IsOutlier(value, column.DataType, analysis.NumericStats))
                {
                    var correctedValue = HandleOutlier(value, column.DataType, analysis);
                    operations.Add(new CleaningOperation
                    {
                        Type = "OutlierCorrection",
                        Column = column.Name,
                        Method = "IQR",
                        OriginalValue = value,
                        CorrectedValue = correctedValue
                    });
                    stats.OutliersHandled++;
                    return correctedValue;
                }
            }


            // 3. Standardisation des formats
            var standardizedValue = StandardizeFormat(value, column.DataType);
            if (standardizedValue != value)
            {
                operations.Add(new CleaningOperation
                {
                    Type = "FormatStandardization",
                    Column = column.Name,
                    OriginalValue = value,
                    StandardizedValue = standardizedValue
                });
                stats.FormatIssuesFixed++;
                return standardizedValue;
            }

            return value;
        }

        private string ImputeMissingValue(ColumnInfo column, ColumnAnalysis analysis)
        {
            return column.DataType switch
            {
                "Integer" => ImputeInteger(analysis),
                "Decimal" => ImputeDecimal(analysis),
                "String" => ImputeString(analysis),
                "DateTime" => ImputeDateTime(analysis),
                "Boolean" => "false",
                _ => "N/A"
            };
        }

        private string ImputeInteger(ColumnAnalysis analysis)
        {
            if (analysis.IsSkewed && !string.IsNullOrEmpty(analysis.MostFrequent))
            {
                return analysis.MostFrequent;
            }
            else if (analysis.NumericStats != null)
            {
                return ((int)analysis.NumericStats.Median).ToString();
            }
            return "0";
        }

        private string ImputeDecimal(ColumnAnalysis analysis)
        {
            if (analysis.IsSkewed && !string.IsNullOrEmpty(analysis.MostFrequent))
            {
                return analysis.MostFrequent;
            }
            else if (analysis.NumericStats != null)
            {
                return analysis.NumericStats.Median.ToString("F2");
            }
            return "0.00";
        }

        private string ImputeString(ColumnAnalysis analysis)
        {
            if (!string.IsNullOrEmpty(analysis.MostFrequent))
            {
                return analysis.MostFrequent;
            }

            if (analysis.ValueDistribution != null && analysis.ValueDistribution.Any())
            {
                if (analysis.UniqueValues < 20)
                {
                    var topCategory = analysis.ValueDistribution
                        .OrderByDescending(kv => kv.Value)
                        .First().Key;
                    return topCategory;
                }
            }

            return "UNKNOWN";
        }

        private string ImputeDateTime(ColumnAnalysis analysis)
        {
            if (!string.IsNullOrEmpty(analysis.MostFrequent))
            {
                return analysis.MostFrequent;
            }
            return DateTime.Now.ToString("yyyy-MM-dd");
        }

        private List<Dictionary<string, string>> CleanDuplicateRows(
            List<Dictionary<string, string>> data,
            List<CleaningOperation> operations,
            Dictionary<string, ColumnCleaningStats> stats)
        {
            var uniqueRows = new Dictionary<string, Dictionary<string, string>>();
            var duplicatesRemoved = 0;

            foreach (var row in data)
            {
                var rowKey = CreateRowSignature(row);

                if (!uniqueRows.ContainsKey(rowKey))
                {
                    uniqueRows[rowKey] = row;
                }
                else
                {
                    duplicatesRemoved++;
                }
            }

            if (duplicatesRemoved > 0)
            {
                operations.Add(new CleaningOperation
                {
                    Type = "DuplicateRemoval",
                    Method = "ExactMatch",
                    AffectedRows = duplicatesRemoved,
                    Description = $"{duplicatesRemoved} doublons exacts supprimés"
                });

                foreach (var stat in stats.Values)
                {
                    stat.DuplicatesRemoved += duplicatesRemoved;
                    stat.CleanedCount = uniqueRows.Count;
                }
            }

            return uniqueRows.Values.ToList();
        }

        private string DetectColumnDataType(List<string> samples)
        {
            var nonMissing = samples.Where(v => !IsMissingValue(v)).ToList();
            if (!nonMissing.Any()) return "String";

            if (nonMissing.All(v => DateTime.TryParse(v, out _)))
                return "DateTime";

            if (nonMissing.All(v => int.TryParse(v, out _)))
                return "Integer";

            if (nonMissing.All(v => double.TryParse(v.Replace(',', '.'), out _)))
                return "Decimal";

            if (nonMissing.All(v => IsBoolean(v)))
                return "Boolean";

            return "String";
        }

        private bool IsMissingValue(string value)
        {
            var missingIndicators = new[]
            {
                "", "null", "na", "n/a", "nan", "none", "missing",
                "NULL", "N/A", "NaN", "?", "-", "undefined", "not available"
            };
            return string.IsNullOrWhiteSpace(value) || missingIndicators.Contains(value.ToLower());
        }

        private bool IsBoolean(string value)
        {
            var boolValues = new[]
            {
                "true", "false", "1", "0", "yes", "no", "oui", "non",
                "v", "o", "n", "t", "f", "y", "on", "off"
            };
            return boolValues.Contains(value.ToLower());
        }

        private NumericStatistics CalculateNumericStats(double[] values)
        {
            if (values == null || values.Length == 0)
                return new NumericStatistics();

            Array.Sort(values);
            var mean = values.Average();
            var median = CalculateMedian(values);
            var stdDev = CalculateStandardDeviation(values);
            var q1 = CalculatePercentile(values, 0.25);
            var q3 = CalculatePercentile(values, 0.75);
            var iqr = q3 - q1;

            return new NumericStatistics
            {
                Min = values.Min(),
                Max = values.Max(),
                Mean = mean,
                Median = median,
                StdDev = stdDev,
                Q1 = q1,
                Q3 = q3,
                IQR = iqr,
                LowerBound = q1 - 1.5 * iqr,
                UpperBound = q3 + 1.5 * iqr
            };
        }

        private bool IsDistributionSkewed(IEnumerable<double> valuesEnum)
        {
            var values = valuesEnum.ToArray();
            if (values.Length < 10) return false;

            var stats = CalculateNumericStats(values);
            var mean = stats.Mean;
            var median = stats.Median;

            if (stats.StdDev == 0) return false;

            var skewness = 3 * (mean - median) / stats.StdDev;
            return Math.Abs(skewness) > 0.5;
        }

        private bool IsOutlier(string value, string dataType, NumericStatistics stats)
        {
            if (stats == null) return false;

            double numericValue;
            if (dataType == "Integer" && int.TryParse(value, out var intVal))
                numericValue = intVal;
            else if (dataType == "Decimal" && double.TryParse(value.Replace(',', '.'), out var decVal))
                numericValue = decVal;
            else
                return false;

            return numericValue < stats.LowerBound || numericValue > stats.UpperBound;
        }

        private string HandleOutlier(string value, string dataType, ColumnAnalysis analysis)
        {
            if (analysis.NumericStats == null) return value;

            double numericValue;
            if (dataType == "Integer" && int.TryParse(value, out var intVal))
                numericValue = intVal;
            else if (dataType == "Decimal" && double.TryParse(value.Replace(',', '.'), out var decVal))
                numericValue = decVal;
            else
                return value;

            if (numericValue < analysis.NumericStats.LowerBound)
                return analysis.NumericStats.LowerBound.ToString(dataType == "Integer" ? "0" : "F2");
            else
                return analysis.NumericStats.UpperBound.ToString(dataType == "Integer" ? "0" : "F2");
        }

        private string StandardizeFormat(string value, string dataType)
        {
            if (string.IsNullOrEmpty(value)) return value;

            return dataType switch
            {
                "Decimal" => value.Replace(',', '.').Trim(),
                "DateTime" => StandardizeDateTime(value),
                "String" => value.Trim(),
                _ => value
            };
        }

        private string StandardizeDateTime(string value)
        {
            if (DateTime.TryParse(value, out var dt))
                return dt.ToString("yyyy-MM-dd");
            return value;
        }

        private string CalculateMostFrequent(List<string> values)
        {
            if (!values.Any()) return string.Empty;

            return values
                .Where(v => !IsMissingValue(v))
                .GroupBy(v => v)
                .OrderByDescending(g => g.Count())
                .Select(g => g.Key)
                .FirstOrDefault() ?? string.Empty;
        }

        private Dictionary<string, int> CalculateValueDistribution(List<string> values)
        {
            return values
                .Where(v => !IsMissingValue(v))
                .GroupBy(v => v)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        private string CreateRowSignature(Dictionary<string, string> row)
        {
            return string.Join("|", row.Values);
        }

        private void SaveCleanedData(
            List<Dictionary<string, string>> data,
            List<ColumnInfo> columns,
            string outputPath)
        {
            using var writer = new StreamWriter(outputPath);

            var header = string.Join(",", columns.Select(c => $"\"{c.Name}\""));
            writer.WriteLine(header);

            foreach (var row in data)
            {
                var lineValues = new List<string>();
                foreach (var column in columns)
                {
                    var v = row.ContainsKey(column.Name) ? row[column.Name] : "";
                    lineValues.Add($"\"{v.Replace("\"", "\"\"")}\"");
                }
                writer.WriteLine(string.Join(",", lineValues));
            }
        }

        private QualityReport GenerateQualityReport(
            PreCleaningAnalysis analysis,
            Dictionary<string, ColumnCleaningStats> stats,
            List<CleaningOperation> operations)
        {
            var report = new QualityReport
            {
                OriginalRowCount = analysis.TotalRows,
                CleanedRowCount = stats.Any() ? stats.First().Value.CleanedCount : 0,
                OperationsApplied = operations,
                CleaningDate = DateTime.Now
            };

            report.TotalMissingImputed = stats.Sum(s => s.Value.MissingValuesImputed);
            report.TotalDuplicatesRemoved = stats.Any() ? stats.First().Value.DuplicatesRemoved : 0;
            report.TotalOutliersHandled = stats.Sum(s => s.Value.OutliersHandled);
            report.TotalFormatIssuesFixed = stats.Sum(s => s.Value.FormatIssuesFixed);

            return report;
        }

        public class ColumnInfo
        {
            public string Name { get; set; } = string.Empty;
            public string DataType { get; set; } = "Unknown";
            public int Position { get; set; }
            public List<string> Samples { get; set; } = new();
            public int MissingCount { get; set; }
            public int UniqueCount { get; set; }
        }

        public class ColumnAnalysis
        {
            public string ColumnName { get; set; } = string.Empty;
            public string DataType { get; set; } = string.Empty;
            // public NumericStatistics NumericStats { get; set; }
            public NumericStatistics? NumericStats { get; set; }

            public string MostFrequent { get; set; } = string.Empty;
            public bool IsSkewed { get; set; }
            public int UniqueValues { get; set; }
            public Dictionary<string, int> ValueDistribution { get; set; } = new();
        }

        public class NumericStatistics
        {
            public double Min { get; set; }
            public double Max { get; set; }
            public double Mean { get; set; }
            public double Median { get; set; }
            public double StdDev { get; set; }
            public double Q1 { get; set; }
            public double Q3 { get; set; }
            public double IQR { get; set; }
            public double LowerBound { get; set; }
            public double UpperBound { get; set; }
        }

        public class CleaningOperation
        {
            public string Type { get; set; } = string.Empty;
            public string Column { get; set; } = string.Empty;
            public string Method { get; set; } = string.Empty;
            public string Value { get; set; } = string.Empty;
            public string OriginalValue { get; set; } = string.Empty;
            public string CorrectedValue { get; set; } = string.Empty;
            public string StandardizedValue { get; set; } = string.Empty;
            public int AffectedRows { get; set; }
            public string Description { get; set; } = string.Empty;
        }

        public class PreCleaningAnalysis
        {
            public string[] ColumnNames { get; set; } = Array.Empty<string>();
            public List<string[]> SampleData { get; set; } = new();
            public int TotalRows { get; set; }
        }

        public class QualityReport
        {
            public int OriginalRowCount { get; set; }
            public int CleanedRowCount { get; set; }
            public int TotalMissingImputed { get; set; }
            public int TotalDuplicatesRemoved { get; set; }
            public int TotalOutliersHandled { get; set; }
            public int TotalFormatIssuesFixed { get; set; }
            public List<CleaningOperation> OperationsApplied { get; set; } = new();
            public DateTime CleaningDate { get; set; }
        }

        private char DetectSeparator(string headerLine)
        {
            if (headerLine.Contains('\t')) return '\t';
            if (headerLine.Contains(';')) return ';';
            if (headerLine.Contains(',')) return ',';
            if (headerLine.Contains('|')) return '|';
            return ',';
        }

        private string[] ParseCsvLine(string line, char separator)
        {
            var result = new List<string>();
            var inQuotes = false;
            var currentValue = new StringBuilder();

            for (int i = 0; i < line.Length; i++)
            {
                var c = line[i];

                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        currentValue.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == separator && !inQuotes)
                {
                    result.Add(currentValue.ToString());
                    currentValue.Clear();
                }
                else
                {
                    currentValue.Append(c);
                }
            }

            result.Add(currentValue.ToString());
            return result.ToArray();
        }

        private int CountTotalRows(string filePath)
        {
            var count = 0;
            using var reader = new StreamReader(filePath);
            while (reader.ReadLine() != null) count++;
            return count - 1;
        }

        private List<int> ExtractIntegerValues(List<string> values)
        {
            var result = new List<int>();
            foreach (var v in values)
            {
                if (int.TryParse(v, out var iv))
                    result.Add(iv);
            }
            return result;
        }

        private List<decimal> ExtractDecimalValues(List<string> values)
        {
            var result = new List<decimal>();
            foreach (var v in values)
            {
                var clean = v.Replace(',', '.');
                if (decimal.TryParse(clean, out var dv))
                    result.Add(dv);
            }
            return result;
        }

        private double CalculateMedian(double[] values)
        {
            Array.Sort(values);
            var count = values.Length;
            if (count == 0) return 0;

            return count % 2 == 0
                ? (values[count / 2 - 1] + values[count / 2]) / 2.0
                : values[count / 2];
        }

        private double CalculateStandardDeviation(double[] values)
        {
            if (values.Length < 2) return 0;

            var mean = values.Average();
            var sum = values.Sum(v => Math.Pow(v - mean, 2));
            return Math.Sqrt(sum / (values.Length - 1));
        }

        private double CalculatePercentile(double[] values, double percentile)
        {
            Array.Sort(values);
            var position = (values.Length - 1) * percentile;
            var index = (int)position;
            var fraction = position - index;

            return index == values.Length - 1
                ? values[index]
                : values[index] + fraction * (values[index + 1] - values[index]);
        }

        private string GetImputationMethod(string dataType, ColumnAnalysis analysis)
        {
            if (analysis.IsSkewed)
                return "ModeImputation";
            if (dataType == "Integer" || dataType == "Decimal")
                return "MedianImputation";
            if (dataType == "String" && analysis.UniqueValues < 20)
                return "ModeImputation";
            return "DefaultValue";
        }
    }
}



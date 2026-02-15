using System.Text;
using System.Text.Json;
using Metiers;

namespace DataHealthCheck.Services
{
    public class DataQualityMetricsService : IDataQualityMetricsService
    {
        public async Task<List<DataQualityMetric>> AnalyzeDatasetAsync(string filePath, int analysisSessionId)
        {
            // 1) Détecter la structure et lire un échantillon
            var columns = await DetectFileStructureAsync(filePath);

            // 2) Analyser chaque colonne
            var allMetrics = new List<DataQualityMetric>();
            for (int i = 0; i < columns.Count; i++)
            {
                var col = columns[i];
                var metrics = AnalyzeColumn(analysisSessionId, col, i + 1);
                allMetrics.Add(metrics);
            }

            // 3) Retourner la liste prête à être sauvegardée par le contrôleur
            return allMetrics;
        }

        // ========== méthodes privées (analyse) ==========

        private async Task<List<ColumnAnalysisResult>> DetectFileStructureAsync(string filePath)
        {
            var result = new List<ColumnAnalysisResult>();

            using var reader = new StreamReader(filePath, Encoding.UTF8);

            var headerLine = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(headerLine))
                throw new Exception("Fichier vide ou en-tête manquant");

            var sep = DetectSeparator(headerLine);
            var columnNames = headerLine.Split(sep);

            var sampleRows = new List<string[]>();
            for (int i = 0; i < 200; i++)
            {
                var line = await reader.ReadLineAsync();
                if (string.IsNullOrEmpty(line)) break;
                sampleRows.Add(line.Split(sep));
            }

            for (int i = 0; i < columnNames.Length; i++)
            {
                var col = new ColumnAnalysisResult
                {
                    ColumnName = columnNames[i].Trim().Trim('"', '\''),
                    Position = i + 1,
                    Values = sampleRows
                        .Select(r => i < r.Length ? r[i].Trim().Trim('"', '\'') : string.Empty)
                        .ToList()
                };

                col.DataType = DetectDataType(col.Values);
                result.Add(col);
            }

            return result;
        }

        private DataQualityMetric AnalyzeColumn(int sessionId, ColumnAnalysisResult col, int position)
        {
            var m = new DataQualityMetric
            {
                AnalysisSessionId = sessionId,
                ColumnName = col.ColumnName,
                DataType = col.DataType,
                Position = position,
                TotalValues = col.Values.Count
            };

            CalculateBasicMetrics(m, col.Values);
            CalculateStatistics(m, col.Values);
            DetectDataPatterns(m, col.Values);
            DetectQualityIssues(m, col.Values);
            CalculateQualityScore(m);

            return m;
        }

        private void CalculateBasicMetrics(DataQualityMetric m, List<string> values)
        {
            m.MissingValues = values.Count(IsMissing);
            var nonMissing = values.Where(v => !IsMissing(v)).ToList();
            m.UniqueValues = nonMissing.Distinct().Count();
            m.DuplicateValues = nonMissing.Count - m.UniqueValues;
        }

        private void CalculateStatistics(DataQualityMetric m, List<string> values)
        {
            var nonMissing = values.Where(v => !IsMissing(v)).ToList();
            var stats = new Dictionary<string, object>();

            if (m.DataType == "Integer")
            {
                var ints = ExtractInts(nonMissing);
                if (ints.Any())
                {
                    stats["min"] = ints.Min();
                    stats["max"] = ints.Max();
                    stats["mean"] = ints.Average();
                }
            }
            else if (m.DataType == "String" && nonMissing.Any())
            {
                stats["minLength"] = nonMissing.Min(v => v.Length);
                stats["maxLength"] = nonMissing.Max(v => v.Length);
                stats["avgLength"] = nonMissing.Average(v => v.Length);
            }

            m.BasicStatistics = JsonSerializer.Serialize(stats);
        }

        private void DetectDataPatterns(DataQualityMetric m, List<string> values)
        {
            var nonMissing = values.Where(v => !IsMissing(v)).ToList();
            var patterns = new List<string>();

            if (m.DataType == "String" && nonMissing.All(v => v.Contains('@')))
                patterns.Add("email_pattern");

            m.DataPatterns = JsonSerializer.Serialize(new { patterns });
        }

        private void DetectQualityIssues(DataQualityMetric m, List<string> values)
        {
            var issues = new List<object>();

            if (m.MissingValues > 0)
                issues.Add(new { type = "missing_values", count = m.MissingValues });

            if (m.DuplicateValues > 0)
                issues.Add(new { type = "duplicate_values", count = m.DuplicateValues });

            m.QualityIssues = JsonSerializer.Serialize(new { issues });
        }

        private void CalculateQualityScore(DataQualityMetric m)
        {
            if (m.TotalValues == 0)
            {
                m.QualityScore = 0;
                return;
            }

            decimal score = 100m;
            var missingPct = (decimal)m.MissingValues / m.TotalValues;
            var dupPct = (decimal)m.DuplicateValues / m.TotalValues;

            score -= missingPct * 50m;
            score -= dupPct * 30m;

            if (score < 0) score = 0;
            if (score > 100) score = 100;

            // Diviser par 100 pour obtenir une valeur entre 0 et 1
            // Limiter à 1.000 maximum pour correspondre à decimal(4,3)
            var qualityScore = score / 100m;
            if (qualityScore > 1.000m) qualityScore = 1.000m;
            
            m.QualityScore = qualityScore; // entre 0.000 et 1.000 (Precision(4,3))
        }

        // ========== utilitaires ==========

        private char DetectSeparator(string header)
        {
            if (header.Contains('\t')) return '\t';
            if (header.Contains(';')) return ';';
            if (header.Contains(',')) return ',';
            return ',';
        }

        private string DetectDataType(List<string> values)
        {
            var nonMissing = values.Where(v => !IsMissing(v)).ToList();
            if (!nonMissing.Any()) return "String";
            if (nonMissing.All(v => int.TryParse(v, out _))) return "Integer";
            if (nonMissing.All(v => DateTime.TryParse(v, out _))) return "DateTime";
            return "String";
        }

        private bool IsMissing(string v)
        {
            if (string.IsNullOrWhiteSpace(v)) return true;
            var low = v.ToLower();
            return low == "null" || low == "na" || low == "n/a";
        }

        private List<int> ExtractInts(List<string> values)
        {
            var list = new List<int>();
            foreach (var v in values)
                if (int.TryParse(v, out var i)) list.Add(i);
            return list;
        }
    }

    public class ColumnAnalysisResult
    {
        public string ColumnName { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public List<string> Values { get; set; } = new();
        public int Position { get; set; }
    }
}

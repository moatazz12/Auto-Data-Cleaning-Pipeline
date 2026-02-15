"""
Auto-Data Cleaning Pipeline - Core Engine
==========================================
Scalable, automated data preprocessing, anomaly resolution, and quality scoring engine.
Designed for reproducible machine learning data preparation.
"""

from dataclasses import dataclass, field
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

import numpy as np
import pandas as pd
from scipy import stats

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("AutoDataCleaner")


@dataclass
class CleaningMetrics:
    """Stores quantitative data health metrics before and after cleaning."""
    original_rows: int = 0
    cleaned_rows: int = 0
    original_columns: int = 0
    missing_values_before: int = 0
    missing_values_after: int = 0
    missing_values_imputed: int = 0
    duplicates_removed: int = 0
    outliers_detected: int = 0
    outliers_handled: int = 0
    completeness_score_before: float = 0.0
    completeness_score_after: float = 0.0
    uniqueness_score_before: float = 0.0
    uniqueness_score_after: float = 0.0
    overall_health_score_before: float = 0.0
    overall_health_score_after: float = 0.0
    operations_applied: List[Dict[str, Any]] = field(default_factory=list)


class AutoDataCleaner:
    """
    Automated Data Preprocessing and Anomaly Detection Pipeline.

    Features:
    - Skewness-aware missing value imputation (Mean / Median / Mode).
    - Interquartile Range (IQR) outlier detection and resolution (clip, drop, or flag).
    - Duplicate record identification and deduplication.
    - Automated schema inference, string whitespace stripping, and format normalization.
    - End-to-end data quality scoring and JSON audit report generation.
    """

    def __init__(
        self,
        outlier_strategy: Literal["clip", "drop", "flag"] = "clip",
        iqr_multiplier: float = 1.5,
        skewness_threshold: float = 0.5,
        remove_duplicates: bool = True,
        normalize_strings: bool = True
    ):
        """
        Initialize the AutoDataCleaner pipeline configuration.

        Args:
            outlier_strategy: How to handle detected outliers ('clip', 'drop', or 'flag').
            iqr_multiplier: IQR boundary factor for Tukey fences (default: 1.5).
            skewness_threshold: Absolute skewness threshold to switch between Mean and Median imputation.
            remove_duplicates: Whether to drop duplicate rows across all columns.
            normalize_strings: Whether to strip leading/trailing whitespace from string columns.
        """
        self.outlier_strategy = outlier_strategy
        self.iqr_multiplier = iqr_multiplier
        self.skewness_threshold = skewness_threshold
        self.remove_duplicates = remove_duplicates
        self.normalize_strings = normalize_strings
        self.metrics = CleaningMetrics()

    def fit_transform(
        self,
        df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, CleaningMetrics]:
        """
        Execute the automated end-to-end cleaning pipeline on the input DataFrame.

        Args:
            df: Raw input pandas DataFrame.

        Returns:
            Tuple of (cleaned DataFrame, CleaningMetrics object).
        """
        data = df.copy()
        logger.info("Initiating automated data cleaning pipeline...")

        # 1. Baseline Quality Metrics Calculation
        total_cells_before = data.size
        null_count_before = int(data.isna().sum().sum())
        duplicates_before = int(data.duplicated().sum())

        self.metrics.original_rows = len(data)
        self.metrics.original_columns = len(data.columns)
        self.metrics.missing_values_before = null_count_before
        self.metrics.completeness_score_before = round(
            (1.0 - (null_count_before / total_cells_before)) * 100.0 if total_cells_before > 0 else 0.0, 2
        )
        self.metrics.uniqueness_score_before = round(
            (1.0 - (duplicates_before / len(data))) * 100.0 if len(data) > 0 else 0.0, 2
        )

        # 2. String Normalization & Whitespace Cleanup
        if self.normalize_strings:
            data = self._normalize_text_features(data)

        # 3. Deduplication
        if self.remove_duplicates and duplicates_before > 0:
            initial_count = len(data)
            data = data.drop_duplicates().reset_index(drop=True)
            removed = initial_count - len(data)
            self.metrics.duplicates_removed = removed
            self.metrics.operations_applied.append({
                "operation": "Deduplication",
                "records_removed": removed,
                "strategy": "drop_duplicates"
            })
            logger.info("Removed %d duplicate rows.", removed)

        # 4. Automated Missing Value Imputation
        data = self._impute_missing_values(data)

        # 5. Outlier Detection and Resolution (IQR Method)
        data = self._handle_outliers(data)

        # 6. Post-Cleaning Quality Metrics Calculation
        total_cells_after = data.size
        null_count_after = int(data.isna().sum().sum())
        duplicates_after = int(data.duplicated().sum())

        self.metrics.cleaned_rows = len(data)
        self.metrics.missing_values_after = null_count_after
        self.metrics.missing_values_imputed = null_count_before - null_count_after
        self.metrics.completeness_score_after = round(
            (1.0 - (null_count_after / total_cells_after)) * 100.0 if total_cells_after > 0 else 100.0, 2
        )
        self.metrics.uniqueness_score_after = round(
            (1.0 - (duplicates_after / len(data))) * 100.0 if len(data) > 0 else 100.0, 2
        )

        # Composite Health Score: 50% Completeness + 30% Uniqueness + 20% Validity
        outlier_penalty_before = min(20.0, (self.metrics.outliers_detected / max(1, self.metrics.original_rows)) * 100.0)
        outlier_penalty_after = 0.0 if self.outlier_strategy in ["clip", "drop"] else outlier_penalty_before

        self.metrics.overall_health_score_before = round(
            max(0.0, (0.5 * self.metrics.completeness_score_before) + (0.3 * self.metrics.uniqueness_score_before) + (20.0 - outlier_penalty_before)), 2
        )
        self.metrics.overall_health_score_after = round(
            max(0.0, (0.5 * self.metrics.completeness_score_after) + (0.3 * self.metrics.uniqueness_score_after) + (20.0 - outlier_penalty_after)), 2
        )

        logger.info(
            "Pipeline completed: Health score improved from %.2f%% to %.2f%%.",
            self.metrics.overall_health_score_before,
            self.metrics.overall_health_score_after
        )

        return data, self.metrics

    def _normalize_text_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Strip whitespace and standardize empty string representations."""
        text_cols = df.select_dtypes(include=["object", "string"]).columns
        for col in text_cols:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace(["", "nan", "NaN", "NULL", "null", "N/A", "n/a", "None"], np.nan)
        return df

    def _impute_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Impute missing values based on statistical distribution characteristics:
        - Numerical features with absolute skewness > threshold use Median; otherwise Mean.
        - Categorical features use Mode (Most Frequent Value).
        """
        for col in df.columns:
            missing_count = int(df[col].isna().sum())
            if missing_count == 0:
                continue

            if pd.api.types.is_numeric_dtype(df[col]):
                non_null = df[col].dropna()
                if len(non_null) == 0:
                    imputed_val = 0.0
                    method = "constant_zero"
                else:
                    col_skew = float(stats.skew(non_null, nan_policy="omit")) if len(non_null) > 2 else 0.0
                    if abs(col_skew) > self.skewness_threshold:
                        imputed_val = float(non_null.median())
                        method = f"median (skewness={col_skew:.2f})"
                    else:
                        imputed_val = float(non_null.mean())
                        method = f"mean (skewness={col_skew:.2f})"

                df[col] = df[col].fillna(imputed_val)
                self.metrics.operations_applied.append({
                    "column": col,
                    "operation": "Missing Value Imputation",
                    "method": method,
                    "imputed_value": round(imputed_val, 4) if isinstance(imputed_val, float) else imputed_val,
                    "count": missing_count
                })

            else:
                # Categorical / Object features
                mode_series = df[col].mode(dropna=True)
                imputed_val = mode_series.iloc[0] if not mode_series.empty else "UNKNOWN"
                df[col] = df[col].fillna(imputed_val)
                self.metrics.operations_applied.append({
                    "column": col,
                    "operation": "Categorical Imputation",
                    "method": "mode",
                    "imputed_value": str(imputed_val),
                    "count": missing_count
                })

        return df

    def _handle_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Detect and treat outliers in numerical columns using Tukey's Interquartile Range (IQR) fences.
        Lower Fence = Q1 - (k * IQR)
        Upper Fence = Q3 + (k * IQR)
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        total_outliers = 0

        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) < 4:
                continue

            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1

            if iqr == 0:
                continue

            lower_bound = q1 - (self.iqr_multiplier * iqr)
            upper_bound = q3 + (self.iqr_multiplier * iqr)

            outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
            num_outliers = int(outlier_mask.sum())

            if num_outliers > 0:
                total_outliers += num_outliers
                if self.outlier_strategy == "clip":
                    df[col] = df[col].clip(lower=lower_bound, upper=upper_bound)
                    action = "clipped_to_iqr_bounds"
                elif self.outlier_strategy == "drop":
                    df = df[~outlier_mask].reset_index(drop=True)
                    action = "dropped_outlier_rows"
                elif self.outlier_strategy == "flag":
                    df[f"{col}_is_outlier"] = outlier_mask.astype(int)
                    action = "created_indicator_flag"
                else:
                    action = "detected_only"

                self.metrics.operations_applied.append({
                    "column": col,
                    "operation": "Outlier Detection & Resolution",
                    "method": "IQR Tukey Fence",
                    "q1": round(q1, 4),
                    "q3": round(q3, 4),
                    "iqr": round(iqr, 4),
                    "bounds": [round(lower_bound, 4), round(upper_bound, 4)],
                    "outliers_found": num_outliers,
                    "action_taken": action
                })

        self.metrics.outliers_detected = total_outliers
        self.metrics.outliers_handled = total_outliers if self.outlier_strategy in ["clip", "drop"] else 0
        return df

    def export_report(self, output_path: Union[str, Path]) -> None:
        """Export comprehensive pipeline metrics and operations log to a JSON audit file."""
        report_data = {
            "pipeline_version": "1.0.0",
            "configuration": {
                "outlier_strategy": self.outlier_strategy,
                "iqr_multiplier": self.iqr_multiplier,
                "skewness_threshold": self.skewness_threshold,
                "remove_duplicates": self.remove_duplicates,
                "normalize_strings": self.normalize_strings
            },
            "summary_metrics": {
                "original_rows": self.metrics.original_rows,
                "cleaned_rows": self.metrics.cleaned_rows,
                "original_columns": self.metrics.original_columns,
                "missing_values_imputed": self.metrics.missing_values_imputed,
                "duplicates_removed": self.metrics.duplicates_removed,
                "outliers_detected": self.metrics.outliers_detected,
                "outliers_handled": self.metrics.outliers_handled,
                "completeness_score_before": self.metrics.completeness_score_before,
                "completeness_score_after": self.metrics.completeness_score_after,
                "uniqueness_score_before": self.metrics.uniqueness_score_before,
                "uniqueness_score_after": self.metrics.uniqueness_score_after,
                "overall_health_score_before": self.metrics.overall_health_score_before,
                "overall_health_score_after": self.metrics.overall_health_score_after
            },
            "operations_applied": self.metrics.operations_applied
        }

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        logger.info("Quality audit report successfully saved to %s", str(path))

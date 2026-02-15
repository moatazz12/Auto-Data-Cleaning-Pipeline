#!/usr/bin/env python3
"""
Auto-Data Cleaning Pipeline - Execution Script
=============================================
Command-line interface to run automated data preprocessing, outlier detection,
and quality reporting on any dataset.

Usage:
    python scripts/run_pipeline.py --input data/sample_raw_data.csv --output data/cleaned_dataset.csv
"""

import argparse
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from pipeline.cleaner import AutoDataCleaner


def parse_args():
    parser = argparse.ArgumentParser(
        description="Auto-Data Cleaning: Automated Preprocessing & Quality Engineering Pipeline"
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        default="data/sample_raw_data.csv",
        help="Path to the raw CSV dataset (default: data/sample_raw_data.csv)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="data/cleaned_dataset.csv",
        help="Path to save the cleaned CSV dataset (default: data/cleaned_dataset.csv)"
    )
    parser.add_argument(
        "--report", "-r",
        type=str,
        default="data/cleaning_report.json",
        help="Path to save the JSON quality audit report (default: data/cleaning_report.json)"
    )
    parser.add_argument(
        "--outlier-strategy",
        choices=["clip", "drop", "flag"],
        default="clip",
        help="Strategy for handling numerical outliers (default: clip)"
    )
    parser.add_argument(
        "--iqr-multiplier",
        type=float,
        default=1.5,
        help="Tukey IQR multiplier fence factor (default: 1.5)"
    )
    return parser.parse_args()


def print_banner():
    print("=" * 75)
    print("      Auto-Data Cleaning - Automated Data Preprocessing Pipeline")
    print("      Institut International de Technologie (IIT) | February 2026")
    print("=" * 75)


def print_summary_table(metrics):
    print("\n" + "-" * 75)
    print(f"{'Data Quality Metric':<35} | {'Before Cleaning':<16} | {'After Cleaning':<16}")
    print("-" * 75)
    print(f"{'Total Records (Rows)':<35} | {metrics.original_rows:<16} | {metrics.cleaned_rows:<16}")
    print(f"{'Total Features (Columns)':<35} | {metrics.original_columns:<16} | {metrics.original_columns:<16}")
    print(f"{'Missing Cells (Nulls)':<35} | {metrics.missing_values_before:<16} | {metrics.missing_values_after:<16}")
    print(f"{'Completeness Rate':<35} | {metrics.completeness_score_before:>14.2f}% | {metrics.completeness_score_after:>14.2f}%")
    print(f"{'Uniqueness Rate':<35} | {metrics.uniqueness_score_before:>14.2f}% | {metrics.uniqueness_score_after:>14.2f}%")
    print(f"{'Outliers Handled (IQR)':<35} | {'N/A':<16} | {metrics.outliers_handled:<16}")
    print(f"{'Duplicates Removed':<35} | {'N/A':<16} | {metrics.duplicates_removed:<16}")
    print("-" * 75)
    print(f"{'Overall Data Health Score':<35} | {metrics.overall_health_score_before:>14.2f}% | {metrics.overall_health_score_after:>14.2f}%")
    print("-" * 75 + "\n")


def main():
    print_banner()
    args = parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[ERROR] Input dataset file not found: {input_path}")
        print("Please check the path or use the included sample dataset: data/sample_raw_data.csv")
        sys.exit(1)

    print(f"[*] Ingesting raw dataset: {input_path}")
    df_raw = pd.read_csv(input_path)
    print(f"[*] Loaded {len(df_raw)} rows and {len(df_raw.columns)} columns successfully.")

    cleaner = AutoDataCleaner(
        outlier_strategy=args.outlier_strategy,
        iqr_multiplier=args.iqr_multiplier
    )

    print("[*] Executing automated pipeline transformations...")
    df_cleaned, metrics = cleaner.fit_transform(df_raw)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(output_path, index=False)
    print(f"[SUCCESS] Cleaned dataset saved to: {output_path}")

    report_path = Path(args.report)
    cleaner.export_report(report_path)
    print(f"[SUCCESS] Quality audit report saved to: {report_path}")

    print_summary_table(metrics)


if __name__ == "__main__":
    main()

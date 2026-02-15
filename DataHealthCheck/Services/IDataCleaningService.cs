namespace DataHealthCheck.Services
{
    public interface IDataCleaningService
    {
        DataCleaningService.CleaningResult CleanDatasetGeneric(
            string inputFilePath,
            string outputFilePath);
    }
}




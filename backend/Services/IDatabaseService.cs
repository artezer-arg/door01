using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    public interface IDatabaseService
    {
        Task<DateTime> GetServerDateTimeAsync();
        Task<bool> TestConnectionAsync(string connectionString);
        Task<PanelSequence?> GetNextPanelAsync(string puesto);
        Task<Equivalencia?> GetEquivalenceAsync(string codigoPanel);
        Task<IEnumerable<Equivalencia>> GetEquivalencesAsync();
        Task<bool> UpsertEquivalenceAsync(Equivalencia equiv, string user);
        Task<bool> DeleteEquivalenceAsync(int id);
        Task<string> GetConfigValueAsync(string key, string defaultValue = "");
        Task<Dictionary<string, string>> GetConfigsAsync();
        Task<bool> UpdateConfigValueAsync(string key, string value, string user, string? motivo);
        Task<bool> UpdateConfigsBatchAsync(IEnumerable<(string Key, string Value, string? Motivo)> items, string user);
        Task<IEnumerable<AuditConfig>> GetConfigAuditsAsync();
        Task<bool> CheckQrProcessedAsync(string qr);
        Task<Validacion?> GetPriorValidationByQrAsync(string qr);
        Task<int> InsertValidationLogAsync(Validacion log);
        Task<bool> UpdateValidationPrintStatusAsync(int id, string status, string? printer, string? technicalError);
        Task<bool> UpdateValidationPointerAdvancedAsync(int id);
        Task CompletePanelProcessAsync(int idOrdenProduccion, int idOrdenCliente, string puesto, int orden);
        Task<IEnumerable<Validacion>> GetValidationHistoryAsync(
            DateTime? desde, DateTime? hasta, string? panel, string? ornament, 
            int? ordenId, int? secuencia, string? puesto, string? result, string? motivo);
        Task<PanelSequence?> GetOrderProductionByIdAsync(int idOrdenProduccion);
        Task<List<int>> GetPickPositionsForReferenceAsync(string referencia);
        Task<IEnumerable<LinkSocketTcp>> GetLinkSocketsAsync();
        Task<bool> UpsertLinkSocketAsync(string referencia, string señal);
        Task<bool> DeleteLinkSocketAsync(string referencia);
        Task<Validacion?> GetLatestApprovedValidationByOrderAsync(int idOrdenProduccion);
    }
}

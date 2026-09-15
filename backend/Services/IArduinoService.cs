using System.Collections.Generic;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    public interface IArduinoService
    {
        ArduinoStatus GetStatus();
        Task<bool> SendPickOrderAsync(string orden, IEnumerable<int> positions);
        Task<bool> SendClearAsync();
        Task<bool> SendLightTestAsync(int position, bool state);
        Task<bool> TriggerPanelLightsAsync(string referencia, int idOrdenProduccion);
        Task ReconnectAsync();
        Task ReloadConfigAsync();
    }
}

using Backend.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://*:5121");

// Add services to the container.
builder.Services.AddControllers();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register Custom Services
builder.Services.AddSingleton<IDatabaseService, DatabaseService>();
builder.Services.AddSingleton<IQrParsingService, QrParsingService>();
builder.Services.AddSingleton<IPrintingService, PrintingService>();
builder.Services.AddSingleton<ArduinoService>();
builder.Services.AddSingleton<IArduinoService>(sp => sp.GetRequiredService<ArduinoService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<ArduinoService>());

var app = builder.Build();

// Configure the HTTP request pipeline.
// In industrial PCs, we want swagger always enabled for quick configuration/debugging.
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");

// Disable HTTPS redirection for easier local offline deployment on plant floors
// app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();

app.MapControllers();

app.Run();

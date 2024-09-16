import { fetchWeatherApi } from 'openmeteo';

export class OpenMeteoWeather {
  async execute(latitude: string, longitude: string): Promise<string> {
    try {
      if (!latitude || !longitude) {
        return 'Please provide latitude and longitude as arguments.';
      }

      const params = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        hourly: 'temperature_2m',
        timezone: 'auto'
      };

      const url = 'https://api.open-meteo.com/v1/forecast';
      const responses = await fetchWeatherApi(url, params);

      const response = responses[0];
      const hourly = response.hourly()!;

      const current = {
        time: new Date(Number(hourly.time()) * 1000),
        temperature: hourly.variables(0)!.value()
      };
      

      return `Current weather at ${latitude}, ${longitude}:
Time: ${current.time.toISOString()}
Temperature: ${current.temperature}°C`;

    } catch (error) {
      return `Error fetching weather data: ${error}`;
    }
  }
}
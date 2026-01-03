import axios from 'axios';
import * as cheerio from 'cheerio';

interface WeatherData {
  description: string;
  temperature: number;
  minTemperature?: number;
  maxTemperature?: number;
  feelsLike?: number;
  humidity?: number;
  windSpeed?: number;
  pm10?: string;
  pm25?: string;
  uvIndex?: string;
  sunset?: string;
}

export class WeatherScraper {
  private location: string;

  constructor(location?: string) {
    this.location = location || process.env.WEATHER_LOCATION || '서울';
  }

  async getWeather(): Promise<WeatherData | null> {
    return await this.getWeatherFromNaver();
  }

  // 하위 호환성 유지
  async getWeatherForDongcheon(): Promise<WeatherData | null> {
    return await this.getWeather();
  }

  private async getWeatherFromNaver(): Promise<WeatherData | null> {
    try {
      const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(this.location)}+날씨`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
        }
      });

      const $ = cheerio.load(response.data);

      console.log('네이버 검색 결과에서 날씨 정보 추출 중...');

      // 현재 온도
      let temperature = 0;
      const temperatureSelectors = [
        '.temperature_text',
        '.main_temp',
        '.current strong',
        '.today_area .temp'
      ];

      for (const selector of temperatureSelectors) {
        const tempText = $(selector).text();
        const tempMatch = tempText.match(/-?\d+(?:\.\d+)?/);
        if (tempMatch) {
          temperature = Math.round(parseFloat(tempMatch[0]));
          break;
        }
      }

      // 날씨 상태
      let description = '맑음';
      const descSelectors = [
        '.weather_main',
        '.cast_txt',
        '.summary_txt',
        '.today_area .main .cast_txt',
        '.current .weather',
        '.weather_description'
      ];

      for (const selector of descSelectors) {
        const descText = $(selector).first().text().trim();
        if (descText && !descText.includes('°') && !descText.includes('어제') && descText.length < 10) {
          description = descText;
          break;
        }
      }

      if (description.length > 10) {
        const firstWord = description.split(/\s+/)[0];
        if (firstWord && firstWord.length < 10) {
          description = firstWord;
        }
      }

      // 최저/최고 온도
      let minTemperature: number | undefined;
      let maxTemperature: number | undefined;

      const wholeText = $('body').text();

      const tempRangeMatch1 = wholeText.match(/(\d+)°\s*(\d+)°/);
      if (tempRangeMatch1) {
        minTemperature = parseInt(tempRangeMatch1[1]);
        maxTemperature = parseInt(tempRangeMatch1[2]);
      }

      if (!minTemperature || !maxTemperature) {
        const koreanTempMatch = wholeText.match(/최저[^\d]*(\d+)[^\d]*최고[^\d]*(\d+)/);
        if (koreanTempMatch) {
          minTemperature = parseInt(koreanTempMatch[1]);
          maxTemperature = parseInt(koreanTempMatch[2]);
        }
      }

      // 최저가 최고보다 크면 swap (네이버에서 순서가 다를 수 있음)
      if (minTemperature !== undefined && maxTemperature !== undefined && minTemperature > maxTemperature) {
        [minTemperature, maxTemperature] = [maxTemperature, minTemperature];
      }

      // 체감온도
      let feelsLike: number | undefined;
      const infoText = $('.today_area .info_list').text() || $('.detail_box').text() || wholeText;
      if (infoText.includes('체감')) {
        const feelsMatch = infoText.match(/체감[^\d]*(\d+(?:\.\d+)?)/);
        if (feelsMatch) {
          feelsLike = Math.round(parseFloat(feelsMatch[1]));
        }
      }

      // 습도
      let humidity: number | undefined;
      const humidityMatch = infoText.match(/습도[^\d]*(\d+)%/);
      if (humidityMatch) {
        humidity = parseInt(humidityMatch[1]);
      }

      // 바람
      let windSpeed: number | undefined;
      const windMatch = infoText.match(/(\d+(?:\.\d+)?)m\/s/);
      if (windMatch) {
        windSpeed = parseFloat(windMatch[1]);
      }

      // 미세먼지
      let pm10: string | undefined;
      const dustMatch = wholeText.match(/미세먼지[^\w]*(좋음|보통|나쁨|매우나쁨)/);
      if (dustMatch) pm10 = dustMatch[1];

      // 초미세먼지
      let pm25: string | undefined;
      const fineDustMatch = wholeText.match(/초미세먼지[^\w]*(좋음|보통|나쁨|매우나쁨)/);
      if (fineDustMatch) pm25 = fineDustMatch[1];

      // 자외선
      let uvIndex: string | undefined;
      const uvMatch = wholeText.match(/자외선[^\w]*(좋음|보통|나쁨|매우나쁨)/);
      if (uvMatch) uvIndex = uvMatch[1];

      // 일몰 시간
      let sunset: string | undefined;
      const sunsetMatch = wholeText.match(/일몰[^\d]*(\d{1,2}:\d{2})/);
      if (sunsetMatch) sunset = sunsetMatch[1];

      console.log('수집된 날씨 정보:', {
        temperature,
        description,
        minTemperature,
        maxTemperature,
        feelsLike,
        humidity,
        windSpeed,
        pm10,
        pm25,
        uvIndex,
        sunset
      });

      // 온도가 0이거나 description만 있어도 반환 (0도도 유효한 온도)
      // 최소한 하나의 정보라도 있으면 반환
      const hasAnyData = temperature !== 0 || minTemperature || humidity || pm10;

      if (description || hasAnyData) {
        return {
          description: description.trim() || '정보 없음',
          temperature: temperature || minTemperature || 0,
          minTemperature,
          maxTemperature,
          feelsLike,
          humidity,
          windSpeed,
          pm10,
          pm25,
          uvIndex,
          sunset
        };
      }

      return null;
    } catch (error) {
      console.error('네이버 날씨 스크래핑 실패:', error);
      return null;
    }
  }

  formatWeatherForLogseq(weather: WeatherData): string[] {
    const lines: string[] = [];

    // 날씨 상태
    lines.push(weather.description);

    // 온도 정보
    if (weather.minTemperature !== undefined && weather.maxTemperature !== undefined) {
      lines.push(`최저 기온 ${weather.minTemperature}도, 최고 기온 ${weather.maxTemperature}도`);
    } else {
      lines.push(`현재 기온 ${weather.temperature}도`);
    }

    // 체감온도
    if (weather.feelsLike !== undefined) {
      lines.push(`체감온도 ${weather.feelsLike}도`);
    }

    // 습도
    if (weather.humidity !== undefined) {
      lines.push(`습도 ${weather.humidity}%`);
    }

    // 바람
    if (weather.windSpeed !== undefined) {
      lines.push(`바람 ${weather.windSpeed}m/s`);
    }

    // 미세먼지
    if (weather.pm10) {
      lines.push(`미세먼지 ${weather.pm10}`);
    }

    // 초미세먼지
    if (weather.pm25) {
      lines.push(`초미세먼지 ${weather.pm25}`);
    }

    // 자외선
    if (weather.uvIndex) {
      lines.push(`자외선 ${weather.uvIndex}`);
    }

    return lines;
  }
}

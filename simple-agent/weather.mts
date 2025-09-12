import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { tool } from '@langchain/core/tools'
import { fetchWeatherApi } from 'openmeteo'
import { z } from 'zod'

const url = "https://api.open-meteo.com/v1/forecast";
const getCurrentTemperature = async ({ latitude, longitude }) => {
  const responses = await fetchWeatherApi(url, {
    latitude,
    longitude,
    hourly: ["temperature_2m", "rain"],
  });
  const response = responses[0]
  const utcOffsetSeconds = response.utcOffsetSeconds();

  const hourly = response.hourly()!
  const weatherData = {
    hourly: {
      time: [...Array((Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval())].map(
        (_, i) => new Date((Number(hourly.time()) + i * hourly.interval() + utcOffsetSeconds) * 1000)
      ),
      temperature_2m: hourly.variables(0)!.valuesArray(),
      rain: hourly.variables(1)!.valuesArray(),
    },
  };

  // Find the current temperature at the current time
  const now = new Date();
  const currentTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

  // Find the closest time index to current time
  let closestIndex = 0;
  let smallestDiff = Math.abs(weatherData.hourly.time[0].getTime() - currentTime.getTime());

  for (let i = 1; i < weatherData.hourly.time.length; i++) {
    const timeDiff = Math.abs(weatherData.hourly.time[i].getTime() - currentTime.getTime());
    if (timeDiff < smallestDiff) {
      smallestDiff = timeDiff;
      closestIndex = i;
    }
  }

  const currentTemperature = weatherData.hourly.temperature_2m![closestIndex];
  console.log(`Current time: ${currentTime.toISOString()}`);
  console.log(`Closest weather time: ${weatherData.hourly.time[closestIndex].toISOString()}`);
  console.log(`Current temperature: ${currentTemperature}°C`);

  return currentTemperature;
}
// getWeather({ latitude: 51.5072, longitude: 0.1276 })




// A minor modification here to add in a custom tool for scientists. 
const convertFahrenheitToKelvin = (fahrenheitTemperature) => {
  console.log("Input temperature", fahrenheitTemperature)
  const temp = (fahrenheitTemperature - 32) * 5 / 9 + 273.15
  console.log("Conversion tool called.") // This works! 
  console.log("temperature: " + temp)
  return temp
}

const convertCelsiusToFahrenheit = (celsius) => {
  console.log("Converting temperature", celsius, "Into Fahrenheit")
  return celsius * 9 / 5 + 32
}

const conversionF2K = tool(convertFahrenheitToKelvin, {
  name: "convertFahrenheitToKelvin",
  description: "Converts Fahrenheit input To Kelvin",
})

const conversionC2F = tool(convertCelsiusToFahrenheit, {
  name: "convertCelsiusToFahrenheit",
  description: "Converts Celsius to Fahrenheit"
})


const getWeatherTool = tool(getCurrentTemperature, {
  name: "getCurrentTemperature",
  description: "Get the current temperature for a specific location. Takes an object with 'latitude' and 'longitude' properties and returns the current temperature in Celsius. Use this after getting coordinates from getLatitudeLongitude tool.",
  schema: z.object({
    latitude: z.number(),
    longitude: z.number()
  }
  )
})

const getLatitudeLongitude = (city: string) => {
  console.log("Getting the latitude and longitude of ", city)
  const cityCoords: { [key: string]: { latitude: number, longitude: number } } = {
    "san francisco": { latitude: 37.7749, longitude: -122.4194 },
    "new york": { latitude: 40.7128, longitude: -74.0060 },
    "london": { latitude: 51.5072, longitude: -0.1276 },
    "paris": { latitude: 48.8566, longitude: 2.3522 },
    "tokyo": { latitude: 35.6762, longitude: 139.6503 }
  };

  const normalizedCity = city.toLowerCase().trim();
  const coords = cityCoords[normalizedCity];

  if (!coords) {
    throw new Error(`City "${city}" not found. Available cities: ${Object.keys(cityCoords).join(", ")}`);
  }

  return coords;
}

const getLatLongTool = tool(getLatitudeLongitude, {
  name: "getLatitudeLongitude",
  description: "Get latitude and longitude coordinates for a city. Takes a city name as input and returns an object with latitude and longitude properties."
})

const main = async () => {
  const agentTools = [conversionF2K, getWeatherTool, getLatLongTool]

  const agentCheckpointer = new MemorySaver()
  // new OpenAI doesnt work here - getting     throw new Error(`llm ${llm} must define bindTools method.`); Using ChatOpenAI instead
  const agent = createReactAgent({ llm: new ChatOpenAI({ temperature: 0 }), tools: agentTools, checkpointSaver: agentCheckpointer })


  const agentFinalState = await agent.invoke(
    { messages: [new HumanMessage("What is the current temperature in San Francisco")] },
    { configurable: { thread_id: 42 } }
  )

  console.log(agentFinalState.messages[agentFinalState.messages.length - 1].content)
  // We really need to walk it through what to do so it can call the correct function at the right time. 
  const agentNextState = await agent.invoke(
    { messages: [new HumanMessage("What about New York?")], },
    { configurable: { thread_id: 42 } }

  )

  console.log(agentNextState.messages[agentNextState.messages.length - 1].content)
}
main()
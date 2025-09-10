import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { createReactAgent} from '@langchain/langgraph/prebuilt'
import { TavilySearch } from '@langchain/tavily'
import { tool } from '@langchain/core/tools'
import {z} from 'zod'



// A minor modification here to add in a custom tool for scientists. 
const  convertFahrenheitToKelvin = (fahrenheitTemperature) => {
    console.log("Input temperature", fahrenheitTemperature)
    const temp = (fahrenheitTemperature - 32 )* 5/9 + 273.15
    console.log("Conversion tool called.") // This works! 
    console.log("temperature: " + temp)
    return temp
}

const conversion = tool(convertFahrenheitToKelvin,{
    name: "convertFahrenheitToKelvin",
    description: "Converts Fahrenheit input To Kelvin",
}  )

const main = async () => {
    const agentTools = [new TavilySearch({maxResults: 3
    }), conversion]
    
    const agentCheckpointer = new MemorySaver()
    // new OpenAI doesnt work here - getting     throw new Error(`llm ${llm} must define bindTools method.`); Using ChatOpenAI instead
    const agent = createReactAgent({llm: new ChatOpenAI({temperature: 0}), tools: agentTools, checkpointSaver: agentCheckpointer})
    
    
    const agentFinalState = await agent.invoke(
        { messages: [new HumanMessage("What is the current weather in San Francisco")]},
        {configurable: {thread_id: 42}}
    )
    
    console.log(agentFinalState.messages[agentFinalState.messages.length -1].content)
    
    const agentNextState = await agent.invoke(
        {messages: [new HumanMessage("What about New York. ")],},
        {configurable: {thread_id: 42}}
    
    )
    
    console.log(agentNextState.messages[agentNextState.messages.length -1].content)
}
main()
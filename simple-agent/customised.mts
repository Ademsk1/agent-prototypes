import { TavilySearch } from "@langchain/tavily";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

const tools = [new TavilySearch({maxResults: 3})]
const toolNode = new ToolNode(tools)



const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
}).bindTools(tools)

const shouldContinue = ({messages}: typeof MessagesAnnotation.State) => {
    const lastMessage = messages[messages.length-1] as AIMessage
    if (lastMessage.tool_calls?.length) {
        return "tools"
    }
    return "__end__"
}

async function callModel(state: typeof MessagesAnnotation.State) {
    const response = model.invoke(state.messages)
}
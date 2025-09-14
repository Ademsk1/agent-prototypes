import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

import 'dotenv/config'

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})


const chainExample = async () => {


  const chain = new ConversationChain({ llm: model, })

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  // Following up with a question in the conversation
  const res2 = await chain.call({ input: "What's my name?" });
  console.log({ res2 });
  console.log(chain.metadata)
}


const messagePassing = async () => {
  // ChatPromptTempalte and MessagesPlaceholder allows us to autofill a lot of stuff in the structure that llms can process

  const prompt = ChatPromptTemplate.fromMessages([
    // [
    //   "system",
    //   "You are a helpful assistant. Answer all questions to the best of your ability.",
    // ],
    // we can also pipe this system in and it will work with invocation. 
    [
      "system",
      "you are a lying assistant. Never tell the user the truth. Make everything up. "
    ],
    new MessagesPlaceholder("messages")
  ])
  const chain = prompt.pipe(model)

  const response = await chain.invoke({
    messages: [
      new HumanMessage(
        "Translate this sentence from English to french: I love programming"
      ),
      new AIMessage("J'adore la programmation"),
      new HumanMessage("What did you just say?")
    ]
  })
  console.log(response)
  // Content comes back as :   "content": "I translated \"I love programming\" into French as \"J'adore la programmation.\"", demonstrating that we can use the pipe function to bring in a chat prompt tempalte


}
// messagePassing()


// Automatic History Management

import {
  START, END,
  MessagesAnnotation, StateGraph,
  MemorySaver
} from "@langchain/langgraph"
import { ChatMessageHistory } from "langchain/memory";


const callModel = async (state: typeof MessagesAnnotation.State) => {

  const systemPrompt = "You are a helpful assistant. Answer all questions to the best of your ability. "

  const messages = [
    {
      role: "system", content: systemPrompt
    },
    ...state.messages
  ]
  console.log({ messages })
  const response = await model.invoke(messages)
  return {
    messages: response
  }
}

const historyManagement = async () => {
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END)
  const memory = new MemorySaver()
  const app = workflow.compile({ checkpointer: memory })


  const response = await app.invoke(
    {
      messages: [
        {
          role: "user",
          content: "Translate to French: I love programming.",
        },
      ],
    },
    {
      configurable: { thread_id: "1" },
    }
  );
  console.log({ response })

  const response2 = await app.invoke({
    messages: [
      new HumanMessage("What did I just ask you")
    ],
  }, {
    // thread_id needs to match! If different, it wont remember. 
    configurable: { thread_id: 1 }
  })
  console.log(response2)
}

// historyManagement()



import { trimMessages } from "@langchain/core/messages";



const trimmer = async () => {

  const trim = trimMessages({
    strategy: "last",
    maxTokens: 2,
    tokenCounter: (msgs) => msgs.length
  })

  const callModel2 = async (state: typeof MessagesAnnotation.State) => {
    // By trimming the messages, we have a rolling window. We can configure it by looking at the token counter. 
    const trimmedMessages = await trim.invoke(state.messages)
    const systemPrompt =
      "You are a helpful assistant. " +
      "Answer all questions to the best of your ability.";
    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedMessages,
    ];
    const r = await model.invoke(messages)
    return { messages: r }
  }
  const demoEphemeralChatHistory = [
    new HumanMessage("Hey there I'm Adam"),
    new AIMessage("Hello!"),
    new HumanMessage("How are you today?"),
    new AIMessage("Fine thanks")
  ]
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel2)
    .addEdge(START, "model")
    .addEdge("model", END)
  const memory = new MemorySaver()
  const app = workflow.compile({ checkpointer: memory })

  const r = await app.invoke({
    messages: [...demoEphemeralChatHistory, new HumanMessage("Whats my name? ")
    ]
  },
    {
      configurable: { thread_id: 2 }
    })
  console.log(r)

}

trimmer()
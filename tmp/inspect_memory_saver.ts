import { MemorySaver } from "@langchain/langgraph";
const saver = new MemorySaver();
console.log("MemorySaver methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(saver)));
console.log("MemorySaver properties:", Object.getOwnPropertyNames(saver));

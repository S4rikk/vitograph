import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Define the State of our Graph.
 * State must be an object type mapped by Annotation.Root.
 */
export const GraphAnnotation = Annotation.Root({
  /**
   * The current conversation history.
   * `messagesStateReducer` handles appending new messages and
   * merging tool messages correctly.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  /**
   * Medical Context: Stores extracted biomarkers or other user health data.
   * We use a simple reducer to merge new objects into the existing state.
   */
  medicalContext: Annotation<Record<string, any>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({}),
  }),
});

export type AgentState = typeof GraphAnnotation.State;

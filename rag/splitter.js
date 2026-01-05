import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50
});

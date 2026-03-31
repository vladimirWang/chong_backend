import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

const baseURL = "https://api.deepseek.com";

console.log("----------deepseekChatStream baseURL----------: ", baseURL);

const deepSeekClient = new OpenAI({
  apiKey,
  baseURL,
  timeout: 60000,
});

export default deepSeekClient;

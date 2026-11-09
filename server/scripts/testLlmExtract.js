const axios = require("axios");

async function test() {
  const apiKey = process.env.OPENROUTER_API_KEY || "";
  const schemaText = 'قسم: "فري استاند" (ID: "68289bdda538615b149a6268")\nالمواصفات: القدرة الحصانية (spec1): [6 حصان / 5 حصان]\nالوسوم: [6 حصان, 5 حصان]';
  
  const messages = [
    {
      role: "system",
      content: `أنت مساعد متجر ذكي. استخرج الفلتر المناسب بصيغة JSON فقط:
{
  "explanation": "شرح قصير",
  "intent": "search",
  "filter": {
    "categoryId": "معرف القسم",
    "specFilters": { "spec1": "6 حصان" },
    "searchKeywords": ""
  }
}
قائمة الأقسام:
${schemaText}`
    },
    {
      role: "user",
      content: "عايز تكييف في حدود 6 حصان"
    }
  ];

  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat",
      messages,
      temperature: 0.1
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  console.log("Raw LLM Output:\n", res.data.choices[0].message.content);
}

test().catch(err => console.error(err.response?.data || err.message));

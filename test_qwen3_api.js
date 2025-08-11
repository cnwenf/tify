// 测试 Qwen3 API 调用格式
// 这个脚本用于验证阿里云百炼 Qwen3 API 的正确调用方式

const testQwen3API = async () => {
  const API_KEY = 'your-api-key-here'; // 请替换为你的实际 API Key
  const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  const testText = 'Hello, world!';
  const sourceLang = '英语';
  const targetLang = '中文';
  
  const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${testText}`;

  console.log('🔍 测试 Qwen3 API 调用...');
  console.log('📝 测试文本:', testText);
  console.log('🌐 翻译方向:', `${sourceLang} → ${targetLang}`);
  console.log('📡 API 端点:', endpoint);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen3-235b-a22b-instruct-2507',
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          max_tokens: 1000,
          temperature: 0.3,
          top_p: 0.8,
          result_format: 'message'
        }
      })
    });

    console.log('📊 响应状态:', response.status);
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 错误响应:', errorText);
      throw new Error(`API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API 响应数据:', JSON.stringify(data, null, 2));

    // 解析响应
    let translation = '';
    if (data.output && data.output.choices && data.output.choices[0]) {
      translation = data.output.choices[0].message.content.trim();
    } else if (data.output && data.output.text) {
      translation = data.output.text.trim();
    } else {
      console.warn('⚠️ 意外的响应格式:', data);
      translation = '翻译失败 - 响应格式异常';
    }

    console.log('🎯 翻译结果:', translation);
    return translation;

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    throw error;
  }
};

// 如果直接运行此脚本
if (typeof window === 'undefined') {
  // Node.js 环境
  const fetch = require('node-fetch');
  testQwen3API().catch(console.error);
} else {
  // 浏览器环境
  console.log('🌐 在浏览器中运行测试...');
  console.log('💡 请在浏览器控制台中调用 testQwen3API() 函数');
  window.testQwen3API = testQwen3API;
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testQwen3API };
}

import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import axios from 'axios';
import { Settings, Play, CheckCircle2, Code, RotateCcw, Save } from 'lucide-react';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

interface Variable {
  name: string;
  address?: string;
  data_type?: string;
  default_value?: string;
  comment?: string;
}

// Dynamically set API_BASE based on current window location
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:18000/api' 
  : `http://${window.location.hostname}:18000/api`;

const App: React.FC = () => {
  const [step, setStep] = useState(1);
  const [demand, setDemand] = useState('');
  const [plcModel, setPlcModel] = useState('S7-1200');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ flowchart: string; variables: Variable[] } | null>(null);
  const [finalCode, setFinalCode] = useState('');
  const [config, setConfig] = useState({ base_url: '', api_key: '', model_name: '' });
  const [showConfig, setShowConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load config on mount
    axios.get(`${API_BASE}/config`).then(res => {
      setConfig(res.data);
    }).catch(err => console.error('Failed to load config:', err));
  }, []);

  useEffect(() => {
    if (step === 2 && preview?.flowchart && mermaidRef.current) {
      mermaid.render('mermaid-svg', preview.flowchart).then(({ svg }) => {
        if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
      });
    }
  }, [step, preview]);

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/generate-preview`, { demand, plc_model: plcModel });
      setPreview(res.data);
      setStep(2);
    } catch (err) {
      alert('生成预览失败: ' + (err as any).response?.data?.detail || (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/generate-code`, {
        demand,
        plc_model: plcModel,
        flowchart: preview.flowchart,
        variables: preview.variables
      });
      setFinalCode(res.data.code);
      setStep(3);
    } catch (err) {
      alert('生成代码失败: ' + (err as any).response?.data?.detail || (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    if (!preview) return;
    const newVars = [...preview.variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setPreview({ ...preview, variables: newVars });
  };

  const handleSaveConfig = async () => {
    try {
      await axios.post(`${API_BASE}/config`, config);
      setShowConfig(false);
      alert('配置已保存');
    } catch (err) {
      alert('保存配置失败: ' + ((err as any).response?.data?.detail || (err as any).message));
    }
  };

  const handleTestConfig = async () => {
    setTestingConfig(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API_BASE}/test-config`, config);
      setTestResult({ success: true, message: res.data.message });
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: (err as any).response?.data?.detail || (err as any).message 
      });
    } finally {
      setTestingConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-800">AI-PLC Siemens Generator</h1>
          <p className="text-gray-600 mt-1">工业互联网全栈架构师级 PLC 自动编程平台</p>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition"
        >
          <Settings className="w-6 h-6 text-gray-600" />
        </button>
      </header>

      {showConfig && (
        <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">大模型接口配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              placeholder="Base URL" 
              className="border p-2 rounded" 
              value={config.base_url} 
              onChange={e => setConfig({...config, base_url: e.target.value})}
            />
            <input 
              placeholder="API Key" 
              type="password"
              className="border p-2 rounded" 
              value={config.api_key} 
              onChange={e => setConfig({...config, api_key: e.target.value})}
            />
            <input 
              placeholder="Model Name" 
              className="border p-2 rounded" 
              value={config.model_name} 
              onChange={e => setConfig({...config, model_name: e.target.value})}
            />
          </div>
          
          {testResult && (
            <div className={`mt-4 p-3 rounded text-sm ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {testResult.message}
            </div>
          )}

          <div className="mt-4 flex gap-4">
            <button 
              onClick={handleTestConfig}
              disabled={testingConfig || !config.api_key}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 disabled:opacity-50 transition"
            >
              {testingConfig ? '测试中...' : '连通性测试'}
            </button>
            <button 
              onClick={handleSaveConfig}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              保存配置
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto">
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 px-12">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex flex-col items-center relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              <span className={`mt-2 text-sm ${step >= s ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {s === 1 ? '需求输入' : s === 2 ? '预览确认' : '代码生成'}
              </span>
              {s < 3 && <div className={`absolute top-5 left-12 w-48 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Input */}
        {step === 1 && (
          <div className="bg-white p-8 rounded-xl shadow-lg animate-fade-in">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">选择目标 PLC 型号</label>
              <div className="flex gap-4">
                {['S7-200SMART', 'S7-1200', 'S7-1500'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPlcModel(m)}
                    className={`px-6 py-2 rounded-lg border-2 transition-all ${
                      plcModel === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-2">描述您的控制需求</label>
              <textarea
                value={demand}
                onChange={e => setDemand(e.target.value)}
                placeholder="例如：实现一个电机启动/停止控制逻辑，包含过载保护和延时停机..."
                className="w-full h-48 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleGeneratePreview}
              disabled={loading || !demand}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'AI 正在思考中...' : <><Play className="w-5 h-5" /> 开始预生成</>}
            </button>
          </div>
        )}

        {/* Step 2: Preview & Edit */}
        {step === 2 && preview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" /> 控制逻辑流程图
              </h3>
              <div ref={mermaidRef} className="bg-gray-50 p-4 rounded border min-h-[300px] flex items-center justify-center overflow-auto" />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" /> 变量表确认与修改
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-700 uppercase">
                    <tr>
                      <th className="p-2 border">名称</th>
                      {plcModel === 'S7-200SMART' ? (
                        <th className="p-2 border">地址</th>
                      ) : (
                        <>
                          <th className="p-2 border">类型</th>
                          <th className="p-2 border">默认值</th>
                        </>
                      )}
                      <th className="p-2 border">注释</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.variables.map((v, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-1 border"><input className="w-full p-1" value={v.name} onChange={e => updateVariable(i, 'name', e.target.value)} /></td>
                        {plcModel === 'S7-200SMART' ? (
                          <td className="p-1 border"><input className="w-full p-1 font-mono" value={v.address} onChange={e => updateVariable(i, 'address', e.target.value)} /></td>
                        ) : (
                          <>
                            <td className="p-1 border"><input className="w-full p-1" value={v.data_type} onChange={e => updateVariable(i, 'data_type', e.target.value)} /></td>
                            <td className="p-1 border"><input className="w-full p-1" value={v.default_value} onChange={e => updateVariable(i, 'default_value', e.target.value)} /></td>
                          </>
                        )}
                        <td className="p-1 border"><input className="w-full p-1" value={v.comment} onChange={e => updateVariable(i, 'comment', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleGenerateCode}
                disabled={loading}
                className="mt-6 w-full bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? '正在生成最终代码...' : <><Code className="w-5 h-5" /> 确认无误，生成代码</>}
              </button>
              <button 
                onClick={() => setStep(1)} 
                className="mt-2 w-full text-gray-500 text-sm hover:underline"
              >
                返回修改需求
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Final Code */}
        {step === 3 && (
          <div className="bg-gray-900 p-8 rounded-xl shadow-2xl animate-fade-in relative">
            <div className="flex justify-between items-center mb-4 text-gray-400 border-b border-gray-700 pb-4">
              <span className="text-sm font-mono">{plcModel} {plcModel === 'S7-200SMART' ? 'AWL/STL' : 'SCL'} Source Code</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(finalCode);
                  alert('代码已复制到剪贴板');
                }}
                className="flex items-center gap-1 hover:text-white transition"
              >
                <Save className="w-4 h-4" /> 复制代码
              </button>
            </div>
            <pre className="text-blue-300 font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {finalCode}
            </pre>
            <button
              onClick={() => setStep(1)}
              className="mt-8 bg-white text-gray-900 px-6 py-2 rounded-lg font-bold hover:bg-gray-100 transition"
            >
              新建项目
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

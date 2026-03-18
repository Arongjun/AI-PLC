import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import axios from 'axios';
import { Settings, Play, CheckCircle2, Code, RotateCcw, Save, Terminal, Layout, FileText, ChevronRight } from 'lucide-react';

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
  const [logs, setLogs] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ flowchart: string; variables: Variable[] } | null>(null);
  const [finalCode, setFinalCode] = useState('');
  const [config, setConfig] = useState({ base_url: '', api_key: '', model_name: '' });
  const [showConfig, setShowConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  const mermaidRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    // Load config on mount
    axios.get(`${API_BASE}/config`).then(res => {
      setConfig(res.data);
      addLog('已加载系统配置');
    }).catch(err => {
      console.error('Failed to load config:', err);
      addLog('错误: 无法加载系统配置');
    });
  }, []);

  useEffect(() => {
    if (step === 2 && preview?.flowchart && mermaidRef.current) {
      try {
        mermaid.render('mermaid-svg-' + Date.now(), preview.flowchart).then(({ svg }) => {
          if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
        });
      } catch (e) {
        addLog(`Mermaid 渲染警告: ${e}`);
      }
    }
  }, [step, preview]);

  const handleGeneratePreview = async () => {
    setLoading(true);
    setLogs([]); // Clear logs for new task
    addLog(`开始任务: 生成 ${plcModel} 控制逻辑预览...`);
    addLog(`需求分析: ${demand.substring(0, 50)}...`);
    
    try {
      const res = await axios.post(`${API_BASE}/generate-preview`, { demand, plc_model: plcModel });
      addLog('AI 响应成功，解析数据中...');
      setPreview(res.data);
      setStep(2);
      addLog('预览生成完成，请在右侧确认逻辑与变量表。');
    } catch (err) {
      const errorMsg = (err as any).response?.data?.detail || (err as any).message;
      addLog(`❌ 错误: ${errorMsg}`);
      alert('生成预览失败: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!preview) return;
    setLoading(true);
    addLog('用户确认无误，开始生成最终 PLC 代码...');
    
    try {
      const res = await axios.post(`${API_BASE}/generate-code`, {
        demand,
        plc_model: plcModel,
        flowchart: preview.flowchart,
        variables: preview.variables
      });
      addLog('代码生成成功！');
      setFinalCode(res.data.code);
      setStep(3);
    } catch (err) {
      const errorMsg = (err as any).response?.data?.detail || (err as any).message;
      addLog(`❌ 错误: ${errorMsg}`);
      alert('生成代码失败: ' + errorMsg);
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
      addLog('配置保存成功');
      alert('配置已保存');
    } catch (err) {
      const msg = (err as any).response?.data?.detail || (err as any).message;
      addLog(`❌ 配置保存失败: ${msg}`);
      alert('保存配置失败: ' + msg);
    }
  };

  const handleTestConfig = async () => {
    setTestingConfig(true);
    setTestResult(null);
    addLog('正在测试 AI 接口连通性...');
    try {
      const res = await axios.post(`${API_BASE}/test-config`, config);
      setTestResult({ success: true, message: res.data.message });
      addLog('✅ 接口连通性测试通过');
    } catch (err) {
      const msg = (err as any).response?.data?.detail || (err as any).message;
      setTestResult({ success: false, message: msg });
      addLog(`❌ 接口测试失败: ${msg}`);
    } finally {
      setTestingConfig(false);
    }
  };

  return (
    <div className="h-screen bg-[#1e1e1e] text-gray-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-[#2d2d2d] border-b border-[#1e1e1e] flex justify-between items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Layout className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-gray-100">AI-PLC Studio</span>
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">v1.0.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${config.api_key ? 'bg-green-500' : 'bg-red-500'}`} />
            {config.model_name || '未配置模型'}
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 hover:bg-[#3d3d3d] rounded transition"
            title="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content - VS Code Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Input & History */}
        <div className="w-1/3 min-w-[350px] bg-[#252526] border-r border-[#1e1e1e] flex flex-col">
          <div className="p-2 bg-[#2d2d2d] text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
            <FileText className="w-3 h-3" /> 项目配置与需求
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">目标 PLC 型号</label>
              <div className="grid grid-cols-3 gap-2">
                {['S7-200SMART', 'S7-1200', 'S7-1500'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPlcModel(m)}
                    className={`px-2 py-2 text-xs rounded border transition-all ${
                      plcModel === m 
                        ? 'bg-[#094771] border-[#007fd4] text-white' 
                        : 'bg-[#3c3c3c] border-transparent hover:bg-[#4c4c4c] text-gray-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">控制逻辑描述</label>
              <textarea
                value={demand}
                onChange={e => setDemand(e.target.value)}
                placeholder="在此输入详细的控制要求，例如：当 I0.0 按下时，电机 Q0.0 启动..."
                className="w-full h-64 bg-[#3c3c3c] text-gray-200 p-3 rounded border border-transparent focus:border-[#007fd4] outline-none text-sm leading-relaxed resize-none font-mono"
              />
            </div>

            <button
              onClick={handleGeneratePreview}
              disabled={loading || !demand}
              className="w-full bg-[#007fd4] text-white py-2 rounded text-sm font-medium hover:bg-[#006ab1] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {loading ? 'AI 正在思考中...' : <><Play className="w-4 h-4" /> 生成预览</>}
            </button>
          </div>

          {/* Terminal / Logs Area */}
          <div className="h-1/3 border-t border-[#1e1e1e] bg-[#1e1e1e] flex flex-col">
            <div className="px-3 py-1 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center gap-2 text-xs text-gray-400">
              <Terminal className="w-3 h-3" /> 输出日志
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
              {logs.length === 0 && <span className="text-gray-600 italic">等待任务开始...</span>}
              {logs.map((log, i) => (
                <div key={i} className="text-gray-400 border-b border-[#2d2d2d] pb-1 last:border-0">
                  <span className="text-[#569cd6]">{log.split(']')[0]}]</span>
                  <span className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}>
                    {log.split(']').slice(1).join(']')}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Right Content - Preview & Code */}
        <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative">
          {/* Config Modal Overlay */}
          {showConfig && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-[#252526] w-[600px] rounded-lg shadow-2xl border border-[#454545] p-6">
                <h2 className="text-lg font-bold text-gray-100 mb-6 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> AI 模型配置
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Base URL</label>
                    <input 
                      className="w-full bg-[#3c3c3c] border border-[#454545] rounded p-2 text-sm text-white focus:border-[#007fd4] outline-none"
                      value={config.base_url} 
                      onChange={e => setConfig({...config, base_url: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">API Key</label>
                      <input 
                        type="password"
                        className="w-full bg-[#3c3c3c] border border-[#454545] rounded p-2 text-sm text-white focus:border-[#007fd4] outline-none"
                        value={config.api_key} 
                        onChange={e => setConfig({...config, api_key: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Model Name</label>
                      <input 
                        className="w-full bg-[#3c3c3c] border border-[#454545] rounded p-2 text-sm text-white focus:border-[#007fd4] outline-none"
                        value={config.model_name} 
                        onChange={e => setConfig({...config, model_name: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {testResult && (
                  <div className={`mt-4 p-3 rounded text-sm flex items-center gap-2 ${testResult.success ? 'bg-[#1e3a2a] text-[#4ec9b0]' : 'bg-[#3a1e1e] text-[#f14c4c]'}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : null}
                    {testResult.message}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    onClick={handleTestConfig}
                    disabled={testingConfig || !config.api_key}
                    className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-white rounded text-sm transition"
                  >
                    {testingConfig ? '测试中...' : '连通性测试'}
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    className="px-4 py-2 bg-[#007fd4] hover:bg-[#006ab1] text-white rounded text-sm transition"
                  >
                    保存配置
                  </button>
                  <button 
                    onClick={() => setShowConfig(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm transition"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview Area */}
          {step === 2 && preview && (
            <div className="flex-1 flex flex-col h-full animate-fade-in">
              <div className="h-1/2 border-b border-[#2d2d2d] flex flex-col">
                <div className="px-4 py-2 bg-[#2d2d2d] text-xs font-bold text-gray-400 flex justify-between items-center">
                  <span className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> 逻辑流程图预览</span>
                  <span className="text-[10px] bg-[#3c3c3c] px-2 py-0.5 rounded text-gray-500">Mermaid.js Rendered</span>
                </div>
                <div ref={mermaidRef} className="flex-1 bg-[#1e1e1e] p-4 overflow-auto flex items-center justify-center" />
              </div>
              
              <div className="h-1/2 flex flex-col bg-[#1e1e1e]">
                <div className="px-4 py-2 bg-[#2d2d2d] text-xs font-bold text-gray-400 flex justify-between items-center">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 变量表配置</span>
                  <button
                    onClick={handleGenerateCode}
                    disabled={loading}
                    className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {loading ? '生成中...' : <><Code className="w-3 h-3" /> 确认并生成代码</>}
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-[#252526] text-gray-400 sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-[#3c3c3c] font-normal pl-4">名称</th>
                        {plcModel === 'S7-200SMART' ? (
                          <th className="p-2 border-b border-[#3c3c3c] font-normal">地址</th>
                        ) : (
                          <>
                            <th className="p-2 border-b border-[#3c3c3c] font-normal">类型</th>
                            <th className="p-2 border-b border-[#3c3c3c] font-normal">默认值</th>
                          </>
                        )}
                        <th className="p-2 border-b border-[#3c3c3c] font-normal">注释</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2d2d]">
                      {preview.variables.map((v, i) => (
                        <tr key={i} className="hover:bg-[#2a2d2e] group">
                          <td className="p-1 pl-4">
                            <input className="w-full bg-transparent text-[#9cdcfe] outline-none" value={v.name} onChange={e => updateVariable(i, 'name', e.target.value)} />
                          </td>
                          {plcModel === 'S7-200SMART' ? (
                            <td className="p-1">
                              <input className="w-full bg-transparent text-[#b5cea8] font-mono outline-none" value={v.address} onChange={e => updateVariable(i, 'address', e.target.value)} />
                            </td>
                          ) : (
                            <>
                              <td className="p-1">
                                <input className="w-full bg-transparent text-[#4ec9b0] outline-none" value={v.data_type} onChange={e => updateVariable(i, 'data_type', e.target.value)} />
                              </td>
                              <td className="p-1">
                                <input className="w-full bg-transparent text-[#ce9178] outline-none" value={v.default_value} onChange={e => updateVariable(i, 'default_value', e.target.value)} />
                              </td>
                            </>
                          )}
                          <td className="p-1">
                            <input className="w-full bg-transparent text-[#6a9955] italic outline-none" value={v.comment} onChange={e => updateVariable(i, 'comment', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Final Code Area */}
          {step === 3 && (
            <div className="flex-1 flex flex-col animate-fade-in">
              <div className="px-4 py-2 bg-[#2d2d2d] text-xs font-bold text-gray-400 flex justify-between items-center border-b border-[#1e1e1e]">
                <span className="flex items-center gap-2"><Code className="w-4 h-4" /> 生成代码结果 ({plcModel})</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setStep(1)}
                    className="text-gray-400 hover:text-white flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> 重置
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(finalCode);
                      alert('代码已复制到剪贴板');
                    }}
                    className="bg-[#007fd4] hover:bg-[#006ab1] text-white px-3 py-1 rounded text-xs flex items-center gap-1 transition"
                  >
                    <Save className="w-3 h-3" /> 复制全部
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-[#1e1e1e] p-0 overflow-auto">
                <pre className="p-4 font-mono text-sm leading-relaxed text-[#d4d4d4]">
                  {finalCode}
                </pre>
              </div>
            </div>
          )}

          {/* Empty State */}
          {step === 1 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
              <div className="w-24 h-24 bg-[#252526] rounded-full flex items-center justify-center mb-4">
                <ChevronRight className="w-12 h-12 opacity-20" />
              </div>
              <p className="text-sm">在左侧输入需求并点击“生成预览”开始</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

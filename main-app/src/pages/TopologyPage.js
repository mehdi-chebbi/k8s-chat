import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Activity, Server, AlertCircle, CheckCircle, GripVertical, X } from 'lucide-react';
import { apiService } from '../services/apiService';

const TopologyPage = ({ user, onLogout }) => {
  const [nodes, setNodes] = useState([]);
  const [pods, setPods] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedPod, setSelectedPod] = useState(null);
  const [viewMode, setViewMode] = useState('nodes'); // nodes, pods, services
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [draggedNode, setDraggedNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [podPositions, setPodPositions] = useState({});
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [modalNodeData, setModalNodeData] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch data based on view mode
  useEffect(() => {
    if (viewMode === 'nodes') {
      fetchNodes();
    } else if (viewMode === 'pods') {
      fetchNamespaces();
      fetchPods();
    }
  }, [viewMode, selectedNamespace]);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTopologyNodes();
      
      if (response.success) {
        setNodes(response.nodes || []);
        // Initialize positions in a grid layout
        const positions = {};
        const gridSize = Math.ceil(Math.sqrt(response.nodes.length));
        const nodeSize = 150;
        const spacing = 200;
        const startX = 100;
        const startY = 100;
        
        response.nodes.forEach((node, index) => {
          const row = Math.floor(index / gridSize);
          const col = index % gridSize;
          positions[node.name] = {
            x: startX + col * spacing,
            y: startY + row * spacing,
            width: nodeSize,
            height: nodeSize
          };
        });
        
        setNodePositions(positions);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNamespaces = async () => {
    try {
      const response = await apiService.getNamespaces();
      if (response.success) {
        setNamespaces(['all', ...(response.namespaces || [])]);
      }
    } catch (err) {
      console.error('Failed to fetch namespaces:', err);
    }
  };

  const fetchPods = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTopologyPods(selectedNamespace);
      
      if (response.success) {
        setPods(response.pods || []);
        
        // Group pods by node
        const podsByNode = {};
        response.pods.forEach(pod => {
          const nodeName = pod.node_name || 'unknown-node';
          if (!podsByNode[nodeName]) {
            podsByNode[nodeName] = [];
          }
          podsByNode[nodeName].push(pod);
        });
        
        // Get node positions in a grid layout
        const nodePositions = {};
        const nodeNames = Object.keys(podsByNode);
        const gridSize = Math.ceil(Math.sqrt(nodeNames.length));
        const nodeSize = 250;
        const spacing = 300;
        const startX = 100;
        const startY = 100;
        
        nodeNames.forEach((nodeName, index) => {
          const row = Math.floor(index / gridSize);
          const col = index % gridSize;
          
          // Calculate pod positions inside the node
          const pods = podsByNode[nodeName];
          const podGridSize = Math.ceil(Math.sqrt(pods.length));
          const podSize = 20;
          const podSpacing = 25;
          const podStartX = 25;
          const podStartY = 25;
          
          const podPositions = pods.map((pod, podIndex) => {
            const podRow = Math.floor(podIndex / podGridSize);
            const podCol = podIndex % podGridSize;
            return {
              ...pod,
              x: podStartX + podCol * podSpacing,
              y: podStartY + podRow * podSpacing,
              size: podSize
            };
          });
          
          nodePositions[nodeName] = {
            x: startX + col * spacing,
            y: startY + row * spacing,
            width: nodeSize,
            height: nodeSize,
            pods: podPositions
          };
        });
        
        setPodPositions(nodePositions);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e, nodeName) => {
    e.preventDefault();
    setDraggedNode(nodeName);
  };

  const handleMouseMove = (e) => {
    if (!draggedNode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodePositions(prev => ({
      ...prev,
      [draggedNode]: { 
        ...prev[draggedNode], 
        x: x - (prev[draggedNode].width || 75) / 2,
        y: y - (prev[draggedNode].height || 75) / 2
      }
    }));
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  useEffect(() => {
    if (draggedNode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedNode]);

  const handleNodeClick = (nodeName) => {
    const nodeData = podPositions[nodeName];
    if (nodeData) {
      setModalNodeData({
        name: nodeName,
        pods: nodeData.pods
      });
      setShowNodeModal(true);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ready':
      case 'Running':
        return '#10b981'; // green
      case 'NotReady':
      case 'Failed':
      case 'Error':
        return '#ef4444'; // red
      case 'Pending':
        return '#f59e0b'; // yellow
      case 'Succeeded':
        return '#8b5cf6'; // purple
      default:
        return '#6b7280'; // gray
    }
  };

  const getPodPhaseColor = (phase) => {
    switch (phase) {
      case 'Running':
        return '#10b981'; // green
      case 'Pending':
        return '#f59e0b'; // yellow
      case 'Failed':
        return '#ef4444'; // red
      case 'Succeeded':
        return '#8b5cf6'; // purple
      case 'Unknown':
        return '#6b7280'; // gray
      default:
        return '#6b7280'; // gray
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'master':
        return '#f59e0b'; // amber
      case 'worker':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status, type = 'node') => {
    if (type === 'pod') {
      switch (status) {
        case 'Running':
          return <CheckCircle className="w-4 h-4 text-green-400" />;
        case 'Pending':
          return <Activity className="w-4 h-4 text-yellow-400" />;
        case 'Failed':
        case 'Error':
          return <AlertCircle className="w-4 h-4 text-red-400" />;
        case 'Succeeded':
          return <CheckCircle className="w-4 h-4 text-purple-400" />;
        default:
          return <Activity className="w-4 h-4 text-gray-400" />;
      }
    } else {
      switch (status) {
        case 'Ready':
          return <CheckCircle className="w-4 h-4 text-green-400" />;
        case 'NotReady':
          return <AlertCircle className="w-4 h-4 text-red-400" />;
        default:
          return <Activity className="w-4 h-4 text-yellow-400" />;
      }
    }
  };

  const handleBackToDashboard = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading topology data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchNodes}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-6 w-px bg-gray-600"></div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <Server className="w-6 h-6 text-blue-400" />
              <span>Cluster Topology</span>
            </h1>
          </div>
          
          {/* View Mode Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">View:</span>
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('nodes')}
                className={`px-3 py-1 rounded ${viewMode === 'nodes' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
              >
                Nodes
              </button>
              <button
                onClick={() => setViewMode('pods')}
                className={`px-3 py-1 rounded ${viewMode === 'pods' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
              >
                Pods
              </button>
              <button
                onClick={() => setViewMode('services')}
                className={`px-3 py-1 rounded ${viewMode === 'services' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
                disabled
              >
                Services (Coming Soon)
              </button>
            </div>
            
            {/* Namespace Filter for Pods */}
            {viewMode === 'pods' && (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-gray-400">Namespace:</span>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  {namespaces.map(ns => (
                    <option key={ns} value={ns}>
                      {ns === 'all' ? 'All Namespaces' : ns}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-screen pt-16">
        {/* 2D Visualization */}
        <div className="flex-1 relative bg-gray-950" ref={containerRef}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="w-full h-full"
            style={{ minHeight: '600px' }}
          >
            {viewMode === 'nodes' ? (
              <>
                {/* Draw connections between nodes */}
                {nodes.map((node, index) => {
                  if (index === 0) return null; // Skip first node (no previous connection)
                  
                  const prevNode = nodes[index - 1];
                  const startPos = nodePositions[prevNode.name];
                  const endPos = nodePositions[node.name];
                  
                  if (!startPos || !endPos) return null;
                  
                  return (
                    <line
                      key={`connection-${prevNode.name}-${node.name}`}
                      x1={startPos.x + startPos.width / 2}
                      y1={startPos.y + startPos.height / 2}
                      x2={endPos.x + endPos.width / 2}
                      y2={endPos.y + endPos.height / 2}
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      opacity="0.6"
                    />
                  );
                })}
                
                {/* Draw nodes as squares */}
                {nodes.map((node) => {
                  const pos = nodePositions[node.name];
                  if (!pos) return null;
                  
                  return (
                    <g key={node.name}>
                      {/* Node square */}
                      <rect
                        x={pos.x}
                        y={pos.y}
                        width={pos.width}
                        height={pos.height}
                        rx="8"
                        fill={getRoleColor(node.role)}
                        stroke={getStatusColor(node.health_status)}
                        strokeWidth="3"
                        className="cursor-move transition-all hover:opacity-80"
                        onMouseDown={(e) => handleMouseDown(e, node.name)}
                        style={{ cursor: draggedNode === node.name ? 'grabbing' : 'grab' }}
                      />
                      
                      {/* Drag indicator */}
                      {draggedNode === node.name && (
                        <text
                          x={pos.x + pos.width / 2}
                          y={pos.y - 10}
                          textAnchor="middle"
                          fill="#fbbf24"
                          fontSize="12"
                          fontWeight="bold"
                        >
                          <GripVertical className="inline w-3 h-3" />
                        </text>
                      )}
                      
                      {/* Node role icon/text */}
                      <text
                        x={pos.x + pos.width / 2}
                        y={pos.y + pos.height / 2}
                        textAnchor="middle"
                        fill="white"
                        fontSize="24"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        {node.role === 'master' ? 'M' : 'W'}
                      </text>
                      
                      {/* Node name below */}
                      <text
                        x={pos.x + pos.width / 2}
                        y={pos.y + pos.height + 20}
                        textAnchor="middle"
                        fill="#d1d5db"
                        fontSize="14"
                        fontWeight="600"
                        pointerEvents="none"
                      >
                        {node.name}
                      </text>
                      
                      {/* Node IP below name */}
                      <text
                        x={pos.x + pos.width / 2}
                        y={pos.y + pos.height + 40}
                        textAnchor="middle"
                        fill="#6b7280"
                        fontSize="12"
                        pointerEvents="none"
                      >
                        {node.ip_addresses.find(ip => ip.type === 'InternalIP')?.address || 'No IP'}
                      </text>
                    </g>
                  );
                })}
              </>
            ) : viewMode === 'pods' ? (
              <>
                {/* Draw nodes as squares with pods inside */}
                {Object.entries(podPositions).map(([nodeName, nodePos]) => {
                  const runningPods = nodePos.pods?.filter(p => p.phase === 'Running').length || 0;
                  const totalPods = nodePos.pods?.length || 0;
                  const problemPods = nodePos.pods?.filter(p => p.phase !== 'Running' && p.phase !== 'Succeeded').length || 0;
                  
                  return (
                    <g key={nodeName}>
                      {/* Node square container */}
                      <rect
                        x={nodePos.x}
                        y={nodePos.y}
                        width={nodePos.width}
                        height={nodePos.height}
                        rx="8"
                        fill="#1f2937"
                        stroke={problemPods > 0 ? "#ef4444" : "#3b82f6"}
                        strokeWidth="3"
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={() => handleNodeClick(nodeName)}
                      />
                      
                      {/* Node name above */}
                      <text
                        x={nodePos.x + nodePos.width / 2}
                        y={nodePos.y - 10}
                        textAnchor="middle"
                        fill="#d1d5db"
                        fontSize="14"
                        fontWeight="bold"
                      >
                        {nodeName}
                      </text>
                      
                      {/* Pod count badge */}
                      <text
                        x={nodePos.x + nodePos.width / 2}
                        y={nodePos.y + 20}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {runningPods}/{totalPods} pods
                      </text>
                      
                      {/* Status indicator */}
                      {problemPods > 0 && (
                        <circle
                          cx={nodePos.x + nodePos.width - 15}
                          cy={nodePos.y + 15}
                          r="6"
                          fill="#ef4444"
                        />
                      )}
                      
                      {/* Draw pods inside the node as a grid */}
                      {nodePos.pods?.map((pod) => {
                        return (
                          <g key={pod.name}>
                            {/* Pod square */}
                            <rect
                              x={nodePos.x + pod.x}
                              y={nodePos.y + pod.y + 30} // Add offset to account for pod count text
                              width={pod.size}
                              height={pod.size}
                              rx="2"
                              fill="#111827"
                              stroke={getPodPhaseColor(pod.phase)}
                              strokeWidth="1"
                              className="cursor-pointer transition-all hover:opacity-80"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPod(selectedPod?.name === pod.name ? null : pod);
                              }}
                            />
                            
                            {/* Pod status indicator */}
                            <circle
                              cx={nodePos.x + pod.x + pod.size - 3}
                              cy={nodePos.y + pod.y + 30 + 3}
                              r="2"
                              fill={getPodPhaseColor(pod.phase)}
                            />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </>
            ) : null}
          </svg>
          
          {/* Legend */}
          <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Legend</h3>
            {viewMode === 'nodes' ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-amber-500 rounded border-2 border-green-500"></div>
                  <span>Master Node</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded border-2 border-green-500"></div>
                  <span>Worker Node</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-500 rounded border-2 border-green-500"></div>
                  <span>Unknown Role</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded border-2 border-red-500"></div>
                  <span>Not Ready</span>
                </div>
              </div>
            ) : viewMode === 'pods' ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-700 border-2 border-blue-500 rounded"></div>
                  <span>Node (Healthy)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-700 border-2 border-red-500 rounded"></div>
                  <span>Node (Problems)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-800 border-2 border-green-500 rounded"></div>
                  <span>Pod (Running)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-800 border-2 border-yellow-500 rounded"></div>
                  <span>Pod (Pending)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-800 border-2 border-red-500 rounded"></div>
                  <span>Pod (Failed)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-800 border-2 border-purple-500 rounded"></div>
                  <span>Pod (Succeeded)</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Controls Hint */}
          <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Controls</h3>
            <div className="space-y-1 text-xs text-gray-300">
              {viewMode === 'nodes' ? (
                <>
                  <p>🖱️ Drag nodes to reorganize</p>
                  <p>📊 Click sidebar for details</p>
                </>
              ) : viewMode === 'pods' ? (
                <>
                  <p>🖱️ Click nodes to see pod details</p>
                  <p>📊 Click pods for container info</p>
                  <p>🔍 Filter by namespace above</p>
                  <p>⚡ Node colors show health status</p>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">
              {viewMode === 'nodes' ? 'Node Information' : 'Pod Information'}
            </h2>
            
            {viewMode === 'nodes' && (
              <>
                {nodes.length === 0 ? (
                  <p className="text-gray-400">No nodes found</p>
                ) : (
                  <div className="space-y-3">
                    {nodes.map((node) => (
                      <div
                        key={node.name}
                        className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                        onClick={() => setSelectedNode(selectedNode?.name === node.name ? null : node)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">{node.name}</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              node.role === 'master' ? 'bg-amber-600' : 'bg-blue-600'
                            }`}>
                              {node.role}
                            </span>
                            {getStatusIcon(node.health_status)}
                          </div>
                        </div>
                        
                        {selectedNode?.name === node.name && (
                          <div className="mt-3 pt-3 border-t border-gray-600 text-xs space-y-2">
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <span className="ml-2">{node.health_status}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Created:</span>
                              <span className="ml-2">
                                {new Date(node.creationTimestamp).toLocaleDateString()}
                              </span>
                            </div>
                            {node.ip_addresses.length > 0 && (
                              <div>
                                <span className="text-gray-400">IP Addresses:</span>
                                <div className="ml-2 space-y-1">
                                  {node.ip_addresses.map((addr, idx) => (
                                    <div key={idx} className="text-gray-300">
                                      {addr.type}: {addr.address}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {node.podCIDR && (
                              <div>
                                <span className="text-gray-400">Pod CIDR:</span>
                                <span className="ml-2">{node.podCIDR}</span>
                              </div>
                            )}
                            {node.capacity.cpu && (
                              <div>
                                <span className="text-gray-400">CPU Capacity:</span>
                                <span className="ml-2">{node.capacity.cpu}</span>
                              </div>
                            )}
                            {node.capacity.memory && (
                              <div>
                                <span className="text-gray-400">Memory Capacity:</span>
                                <span className="ml-2">{node.capacity.memory}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {viewMode === 'pods' && (
              <>
                {Object.keys(podPositions).length === 0 ? (
                  <p className="text-gray-400">No pods found</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(podPositions).map(([nodeName, nodePos]) => {
                      const runningPods = nodePos.pods?.filter(p => p.phase === 'Running').length || 0;
                      const totalPods = nodePos.pods?.length || 0;
                      const problemPods = nodePos.pods?.filter(p => p.phase !== 'Running' && p.phase !== 'Succeeded').length || 0;
                      
                      return (
                        <div
                          key={nodeName}
                          className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                          onClick={() => setSelectedNode(selectedNode?.name === nodeName ? {name: nodeName, pods: nodePos.pods} : null)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-sm">{nodeName}</h3>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs px-2 py-1 bg-gray-600 rounded">
                                {runningPods}/{totalPods} pods
                              </span>
                              {problemPods > 0 ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              )}
                            </div>
                          </div>
                          
                          {selectedNode?.name === nodeName && (
                            <div className="mt-3 pt-3 border-t border-gray-600 text-xs space-y-2">
                              <div>
                                <span className="text-gray-400">Running Pods:</span>
                                <span className="ml-2">{runningPods}/{totalPods}</span>
                              </div>
                              {problemPods > 0 && (
                                <div>
                                  <span className="text-gray-400">Problem Pods:</span>
                                  <span className="ml-2 text-red-400">{problemPods}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Node Details Modal */}
      {showNodeModal && modalNodeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{modalNodeData.name} - Pods</h2>
              <button
                onClick={() => setShowNodeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 gap-3">
                {modalNodeData.pods.map((pod) => (
                  <div
                    key={pod.name}
                    className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(pod.phase, 'pod')}
                        <h3 className="font-medium">{pod.name}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          pod.phase === 'Running' ? 'bg-green-600' :
                          pod.phase === 'Pending' ? 'bg-yellow-600' :
                          pod.phase === 'Failed' ? 'bg-red-600' :
                          pod.phase === 'Succeeded' ? 'bg-purple-600' : 'bg-gray-600'
                        }`}>
                          {pod.phase}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Namespace:</span>
                        <span className="ml-2">{pod.namespace}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Node:</span>
                        <span className="ml-2">{pod.node_name}</span>
                      </div>
                      {pod.pod_ip && (
                        <div>
                          <span className="text-gray-400">Pod IP:</span>
                          <span className="ml-2">{pod.pod_ip}</span>
                        </div>
                      )}
                      {pod.created_at && (
                        <div>
                          <span className="text-gray-400">Created:</span>
                          <span className="ml-2">{new Date(pod.created_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    
                    {pod.containers && pod.containers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <span className="text-gray-400 text-sm">Containers:</span>
                        <div className="mt-1 space-y-1">
                          {pod.containers.map((container, idx) => (
                            <div key={idx} className="text-sm text-gray-300 flex items-center">
                              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                              {container.name}
                              {container.ready && (
                                <span className="ml-2 text-xs text-green-400">(Ready)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Total: {modalNodeData.pods.length} pods
              </div>
              <button
                onClick={() => setShowNodeModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopologyPage;
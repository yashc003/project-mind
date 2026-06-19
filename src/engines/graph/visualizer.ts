import path from 'node:path';
import fs from 'node:fs';
import { getMemoryFilePaths } from '../memory/schema.js';
import { ensureDir, writeText } from '../../utils/fs.js';
import type { KnowledgeGraph } from '../../types/index.js';

export async function generateGraphViewer(graph: KnowledgeGraph, projectPath: string, focusTarget?: string): Promise<string> {
  const paths = getMemoryFilePaths(projectPath);
  
  // Create a minimal sanitized version of the graph to inject
  const graphData = {
    nodes: graph.nodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties || {},
    })),
    edges: graph.edges.map(e => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
    })),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project-Mind Knowledge Graph</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --panel-bg: rgba(30, 41, 59, 0.85);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      
      --color-component: #6366f1;
      --color-feature: #8b5cf6;
      --color-workflow: #06b6d4;
      --color-decision: #f59e0b;
      --color-agent: #10b981;
      --color-file: #64748b;
      --color-class: #ec4899;
      --color-interface: #ec4899;
      --color-function: #14b8a6;
      --color-enum: #f97316;
      --color-type_alias: #f97316;
      --color-generic: #94a3b8;
    }
    
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    }
    
    #canvas-container {
      width: 100vw;
      height: 100vh;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }
    
    .glass-panel {
      background: var(--panel-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    #ui-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }
    
    .interactive {
      pointer-events: auto;
    }
    
    #top-bar {
      position: absolute;
      top: 16px;
      left: 16px;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    #search-container {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      width: 400px;
      z-index: 100;
    }
    
    #search-container.active {
      top: 24px;
      left: 24px;
      transform: none;
      width: 300px;
    }

    #search-box {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid var(--color-component);
      color: var(--text);
      padding: 12px 16px;
      border-radius: 8px;
      width: 100%;
      font-size: 16px;
      outline: none;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transition: all 0.3s;
    }
    
    #search-box:focus {
      border-color: var(--color-feature);
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
    }
    
    #autocomplete-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 101;
      display: none;
    }

    .autocomplete-item {
      padding: 10px 16px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex;
      flex-direction: column;
    }

    .autocomplete-item:hover {
      background: rgba(255,255,255,0.1);
    }

    .autocomplete-label {
      font-weight: 600;
      font-size: 14px;
    }

    .autocomplete-type {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 4px;
    }

    .color-swatch {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      display: inline-block;
    }
    
    #inspector-panel {
      position: absolute;
      top: 16px;
      right: -350px;
      width: 300px;
      bottom: 16px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      z-index: 50;
    }
    
    #inspector-panel.open {
      right: 16px;
    }
    
    #inspector-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 24px;
      padding: 0;
      line-height: 1;
    }
    
    #inspector-close:hover {
      color: var(--text);
    }
    
    .node-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px 0;
      padding-right: 20px;
      word-break: break-all;
    }
    
    .node-type {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
    }
    
    .prop-section {
      margin-bottom: 16px;
    }
    
    .prop-section h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      padding-bottom: 4px;
    }
    
    .prop-row {
      display: flex;
      margin-bottom: 4px;
      font-size: 13px;
    }
    
    .prop-key {
      width: 100px;
      color: var(--text-muted);
    }
    
    .prop-val {
      flex: 1;
      word-break: break-all;
    }
    
    pre {
      background: rgba(0,0,0,0.3);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
      border: 1px solid var(--border);
      margin: 0;
    }
    
    .edge-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .edge-item {
      font-size: 12px;
      margin-bottom: 6px;
      padding: 4px;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      cursor: pointer;
    }
    
    .edge-item:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .edge-rel {
      color: var(--color-component);
      font-weight: 600;
      font-size: 10px;
    }
    
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      color: var(--text-muted);
      z-index: 20;
      pointer-events: none;
      background: var(--panel-bg);
      padding: 16px 32px;
      border-radius: 8px;
      backdrop-filter: blur(4px);
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
    #tooltip {
      position: absolute;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 12px;
      border-radius: 6px;
      pointer-events: none;
      z-index: 50;
      font-size: 13px;
      backdrop-filter: blur(4px);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
      transition: opacity 0.1s;
      max-width: 300px;
      word-wrap: break-word;
      opacity: 0;
      display: none;
    }
    #tooltip.visible {
      opacity: 1;
      display: block;
    }
  </style>
</head>
<body>

  <div id="canvas-container">
    <canvas id="graph-canvas"></canvas>
  </div>

  <div id="ui-layer">
    <div id="tooltip"></div>
    <div id="search-container" class="interactive">
      <input type="text" id="search-box" placeholder="Search for a component, file, or function..." autocomplete="off">
      <div id="autocomplete-list"></div>
    </div>
    
    <div id="inspector-panel" class="interactive glass-panel">
      <button id="inspector-close">×</button>
      <div id="inspector-content"></div>
    </div>
  </div>

  <script type="application/json" id="graph-data">
    ${JSON.stringify(graphData)}
  </script>

  <script>
    // --- Configuration & Colors ---
    const COLORS = {
      component: '#6366f1',
      feature: '#8b5cf6',
      workflow: '#06b6d4',
      decision: '#f59e0b',
      agent: '#10b981',
      file: '#64748b',
      class: '#ec4899',
      interface: '#ec4899',
      function: '#14b8a6',
      enum: '#f97316',
      type_alias: '#f97316',
      generic: '#94a3b8',
      rationale: '#facc15'
    };
    
    function getColor(type) {
      return COLORS[type] || COLORS.generic;
    }

    // --- State ---
    let graphData = JSON.parse(document.getElementById('graph-data').textContent);
    const fullNodes = graphData.nodes;
    let fullLinks = graphData.edges;
    
    // Calculate degree centrality globally once
    const degreeMap = new Map();
    fullLinks.forEach(l => {
      degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1);
      degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1);
    });
    
    // Map connections for fast lookup
    const connectedEdges = {};
    const connectedNodes = {};
    fullNodes.forEach(n => {
      connectedEdges[n.id] = [];
      connectedNodes[n.id] = new Set();
    });
    
    // Clean links that reference missing nodes
    fullLinks = fullLinks.filter(l => connectedEdges[l.source] && connectedEdges[l.target]);
    
    // Populate global connectivity map
    fullLinks.forEach(l => {
      connectedEdges[l.source].push(l);
      connectedEdges[l.target].push(l);
      connectedNodes[l.source].add(l.target);
      connectedNodes[l.target].add(l.source);
    });

    let nodes = [];
    let links = [];
    let simulation = null;
    let quadtree = d3.quadtree();

    let hoveredNode = null;
    let transform = d3.zoomIdentity;
    let width, height;
    
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      render();
    }
    window.addEventListener('resize', resize);
    resize();

    // --- Search & Ego Graph Logic ---
    const searchContainer = document.getElementById('search-container');
    const searchBox = document.getElementById('search-box');
    const autocompleteList = document.getElementById('autocomplete-list');
    const inspectorPanel = document.getElementById('inspector-panel');
    const inspectorContent = document.getElementById('inspector-content');

    document.getElementById('inspector-close').addEventListener('click', () => {
      inspectorPanel.classList.remove('open');
    });

    window.navigateToNode = function(id) {
      renderEgoGraph(id);
    };

    function openInspector(nodeId) {
      const node = fullNodes.find(n => n.id === nodeId);
      if (!node) return;

      inspectorPanel.classList.add('open');

      const incoming = fullLinks.filter(l => (l.target.id || l.target) === nodeId);
      const outgoing = fullLinks.filter(l => (l.source.id || l.source) === nodeId);

      let html = \`
        <div class="node-title">\${node.label}</div>
        <div class="node-type" style="background:\${getColor(node.type)}">\${node.type}</div>
      \`;

      if (Object.keys(node.properties).length > 0) {
        html += '<div class="prop-section"><h4>Properties</h4>';
        for (const [k, v] of Object.entries(node.properties)) {
          let valStr = String(v);
          if (k === 'signature') {
            html += \`<div class="prop-row"><div class="prop-val"><pre>\${valStr}</pre></div></div>\`;
          } else {
            html += \`<div class="prop-row"><div class="prop-key">\${k}</div><div class="prop-val">\${valStr}</div></div>\`;
          }
        }
        html += '</div>';
      }

      if (incoming.length > 0) {
        html += '<div class="prop-section"><h4>Incoming Dependencies</h4><ul class="edge-list">';
        incoming.forEach(edge => {
          const srcId = edge.source.id || edge.source;
          const srcNode = fullNodes.find(n => n.id === srcId);
          if (srcNode) {
            html += \`<li class="edge-item" onclick="navigateToNode('\${srcId}')">
              <span class="color-swatch" style="background:\${getColor(srcNode.type)}"></span>\${srcNode.label}
              <div class="edge-rel">\${edge.relation}</div>
            </li>\`;
          }
        });
        html += '</ul></div>';
      }

      if (outgoing.length > 0) {
        html += '<div class="prop-section"><h4>Outgoing Dependencies</h4><ul class="edge-list">';
        outgoing.forEach(edge => {
          const tgtId = edge.target.id || edge.target;
          const tgtNode = fullNodes.find(n => n.id === tgtId);
          if (tgtNode) {
            html += \`<li class="edge-item" onclick="navigateToNode('\${tgtId}')">
              <span class="color-swatch" style="background:\${getColor(tgtNode.type)}"></span>\${tgtNode.label}
              <div class="edge-rel">\${edge.relation}</div>
            </li>\`;
          }
        });
        html += '</ul></div>';
      }

      inspectorContent.innerHTML = html;
    }

    function renderEgoGraph(centerNodeId) {
      // 1. Move search bar to corner
      searchContainer.classList.add('active');
      searchBox.value = '';
      autocompleteList.style.display = 'none';
      
      openInspector(centerNodeId);

      // 2. Identify local ego graph (Depth 1)
      const allowedNodes = new Set([centerNodeId]);
      if (connectedNodes[centerNodeId]) {
        connectedNodes[centerNodeId].forEach(nid => allowedNodes.add(nid));
      }

      const egoNodes = fullNodes.filter(n => allowedNodes.has(n.id));
      const egoLinks = fullLinks.filter(l => allowedNodes.has(l.source.id || l.source) && allowedNodes.has(l.target.id || l.target));

      // 3. Restart Physics Simulation
      if (simulation) simulation.stop();

      nodes = egoNodes.map(n => ({ ...n, x: width/2 + (Math.random()-0.5)*100, y: height/2 + (Math.random()-0.5)*100, visible: true }));
      links = egoLinks.map(l => ({ source: l.source.id || l.source, target: l.target.id || l.target, relation: l.relation, visible: true }));

      // Recalculate degree for sizing within the ego context (or we can use global degree)
      // Let's use global degree map
      nodes.forEach(n => {
        n.degree = degreeMap.get(n.id) || 0;
        const baseRadius = n.type === 'file' ? 3 : 5;
        n.radius = Math.max(baseRadius, Math.min(18, baseRadius + Math.log1p(n.degree) * 2));
      });

      const chargeStrength = Math.max(-100, -3000 / nodes.length);

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(40).strength(0.8))
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(d => d.radius + 15).iterations(2));

      simulation.on('tick', () => {
        quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(nodes);
        requestAnimationFrame(render);
      });

      // Populate local maps for rendering highlights
      // We don't need to rebuild connectedEdges here because it's global, 
      // but we do need the updated quadtree
      quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(nodes);

      // Smooth camera reset
      d3.select(canvas).transition().duration(750).call(
        d3.zoom().transform, 
        d3.zoomIdentity.translate(0, 0).scale(1)
      );
    }

    searchBox.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      if (!q) {
        autocompleteList.style.display = 'none';
        return;
      }

      const matches = fullNodes
        .filter(n => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
        .slice(0, 8);

      if (matches.length > 0) {
        autocompleteList.innerHTML = matches.map(m => \`
          <div class="autocomplete-item" data-id="\${m.id}">
            <div class="autocomplete-label">\${m.label}</div>
            <div class="autocomplete-type">
              <span class="color-swatch" style="background:\${getColor(m.type)}"></span>\${m.type}
            </div>
          </div>
        \`).join('');
        autocompleteList.style.display = 'block';

        document.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            renderEgoGraph(id);
          });
        });
      } else {
        autocompleteList.style.display = 'none';
      }
    });

    document.addEventListener('click', e => {
      if (!searchContainer.contains(e.target)) {
        autocompleteList.style.display = 'none';
      }
    });

    // --- Rendering ---
    function render() {
      // Increment time for edge animation (if implemented)
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      
      // Draw background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      const isFaded = hoveredNode !== null;
      const highlightBase = hoveredNode;
      const connectedSet = highlightBase ? connectedNodes[highlightBase.id] : new Set();
      const connectedEdgeSet = highlightBase ? new Set(connectedEdges[highlightBase.id]) : new Set();


      // Draw Edges
      ctx.lineWidth = 1 / transform.k;
      
      links.forEach(l => {
        if (!l.visible) return;
        
        const source = l.source;
        const target = l.target;
        
        if (!source || !target) return;

        let alpha = 0.2;
        let isHighlightedEdge = false;
        let edgeDirection = 'none'; // 'outgoing', 'incoming', 'none'
        
        if (isFaded) {
          if (connectedEdgeSet.has(l)) {
            alpha = 1.0;
            isHighlightedEdge = true;
            if (highlightBase && source.id === highlightBase.id) edgeDirection = 'outgoing';
            else if (highlightBase && target.id === highlightBase.id) edgeDirection = 'incoming';
          } else {
            alpha = 0.2; // Faded out
          }
        } else {
          alpha = 0.8; // Default edge opacity (Ego graph needs solid edges)
        }

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        
        if (isHighlightedEdge) {
          ctx.strokeStyle = edgeDirection === 'outgoing' ? '#3b82f6' : (edgeDirection === 'incoming' ? '#f97316' : '#ffffff');
          ctx.lineWidth = 2.5 / transform.k;
        } else {
          ctx.strokeStyle = l.relation === 'RATIONALE_FOR' ? \`rgba(250, 204, 21, \${alpha})\` : \`rgba(150, 150, 150, \${alpha})\`;
          ctx.lineWidth = 1 / transform.k;
        }

        if (l.relation === 'RATIONALE_FOR') {
          ctx.setLineDash([4, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();

        // Draw Arrowhead pointing to target
        const arrowLen = 6 / transform.k;
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        // Calculate point just before target node boundary to place the arrow
        const targetRadius = target.radius || 3;
        const arrowX = target.x - Math.cos(angle) * (targetRadius + 2 / transform.k);
        const arrowY = target.y - Math.sin(angle) * (targetRadius + 2 / transform.k);
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowLen * Math.cos(angle - Math.PI / 6), arrowY - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - arrowLen * Math.cos(angle + Math.PI / 6), arrowY - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      });
      ctx.setLineDash([]);

      // NOTE: We fade out non-connected nodes instead of hiding them completely to preserve spatial context when users drill down.
      // Draw Nodes
      nodes.forEach(n => {
        if (!n.visible) return;

        let alpha = 1.0;
        if (isFaded) {
          if (n === highlightBase) alpha = 1.0;
          else if (connectedSet.has(n.id)) alpha = 0.8;
          else alpha = 0.2; // Increased from 0.1 so nodes don't vanish completely
        }

        ctx.beginPath();
        
        // Base radius
        const radius = n.radius;
        
        // Draw shape
        // vis.js style: always circle with a clear border
        ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);

        ctx.fillStyle = getColor(n.type);
        ctx.globalAlpha = alpha;
        ctx.fill();
        
        // Node Border
        ctx.strokeStyle = n === highlightBase ? '#fff' : '#222';
        ctx.lineWidth = (n === highlightBase ? 2 : 1) / transform.k;
        ctx.stroke();
        
        ctx.globalAlpha = 1.0;

        // Permanent Labels
        if (alpha > 0.1) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ffffff';
          ctx.font = \`\${Math.max(4, 10 / transform.k)}px sans-serif\`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(n.label, n.x, n.y + radius + 3 / transform.k);
          ctx.globalAlpha = 1.0;
        }
      });

      ctx.restore();
      
      // Keep animation running for edge flows if highlighting is active
      if (isFaded) {
        requestAnimationFrame(render);
      }
    }

    // --- Interaction ---
    const zoomBehavior = d3.zoom().scaleExtent([0.1, 10]).on('zoom', e => {
      transform = e.transform;
      render();
    });

    d3.select(canvas)
      .call(zoomBehavior)
      .on('dblclick.zoom', null) // Disable default D3 zoom on double-click
      .on('click', e => {
        if (hoveredNode) {
          openInspector(hoveredNode.id);
        }
      })
      .on('dblclick', e => {
        if (hoveredNode) {
          renderEgoGraph(hoveredNode.id);
        }
      })
      .on('mousemove', e => {
        // Find nearest node
        const ptr = d3.pointer(e);
        const x = transform.invertX(ptr[0]);
        const y = transform.invertY(ptr[1]);
        
        // Search radius 15px scaled
        const node = quadtree.find(x, y, 15 / transform.k);
        
        const tooltip = document.getElementById('tooltip');
        if (node !== hoveredNode) {
          hoveredNode = node;
          canvas.style.cursor = node ? 'pointer' : 'default';
          
          if (node) {
            tooltip.innerHTML = \`<strong>\${node.label}</strong><br><span style="color:\${getColor(node.type)}; font-size:11px;">\${node.type.toUpperCase()}</span>\`;
            tooltip.classList.add('visible');
          } else {
            tooltip.classList.remove('visible');
          }
          
          requestAnimationFrame(render);
        }

        if (hoveredNode) {
          tooltip.style.left = (e.clientX + 15) + 'px';
          tooltip.style.top = (e.clientY + 15) + 'px';
        }
      })


  </script>
</body>
</html>`;

  const timestamp = Date.now();
  const htmlPath = path.join(path.dirname(paths.graphViewer), `GRAPH_VIEWER_${timestamp}.html`);
  
  await ensureDir(path.dirname(htmlPath));
  await writeText(htmlPath, html);

  // Clean up older HTML files to prevent clutter
  try {
    const files = await fs.promises.readdir(path.dirname(htmlPath));
    for (const f of files) {
      if (f.startsWith('GRAPH_VIEWER_') && f.endsWith('.html') && f !== `GRAPH_VIEWER_${timestamp}.html`) {
        await fs.promises.unlink(path.join(path.dirname(htmlPath), f)).catch(() => {});
      }
    }
  } catch (e) {}

  return htmlPath;
}

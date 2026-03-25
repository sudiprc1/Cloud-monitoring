import { useEffect, useRef } from "react";
import * as d3 from "d3";

const RISK_COLOR = {
  critical: "#E24B4A",
  high:     "#EF9F27",
  medium:   "#378ADD",
  low:      "#1D9E75",
};

const TYPE_SHAPE = {
  ec2:            "rect",
  s3:             "circle",
  lambda:         "diamond",
  iam_role:       "triangle",
  security_group: "rect",
  vpc:            "rect",
};

export default function GraphCanvas({ graph, attackPaths, highlightPaths }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!graph || !graph.nodes.length) return;

    const width  = svgRef.current.clientWidth  || 900;
    const height = svgRef.current.clientHeight || 600;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Zoom support
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.2, 4]).on("zoom", e => {
      g.attr("transform", e.transform);
    }));

    // Arrow markers
    const defs = svg.append("defs");
    ["default", "attack"].forEach(id => {
      defs.append("marker")
        .attr("id", `arrow-${id}`)
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 20).attr("refY", 5)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M2 1L8 5L2 9")
        .attr("fill", "none")
        .attr("stroke", id === "attack" ? "#E24B4A" : "#888780")
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round");
    });

    // Build attack path edge set for highlighting
    const attackEdgeSet = new Set();
    if (highlightPaths && attackPaths) {
      attackPaths.forEach(ap => {
        for (let i = 0; i < ap.path.length - 1; i++) {
          attackEdgeSet.add(`${ap.path[i]}|||${ap.path[i+1]}`);
          attackEdgeSet.add(`${ap.path[i+1]}|||${ap.path[i]}`);
        }
      });
    }

    // Force simulation
    const simulation = d3.forceSimulation(graph.nodes)
      .force("link", d3.forceLink(graph.links)
        .id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(40));

    // Links
    const link = g.append("g").selectAll("line")
      .data(graph.links).join("line")
      .attr("stroke", d => {
        const key = `${d.source.id || d.source}|||${d.target.id || d.target}`;
        return attackEdgeSet.has(key) ? "#E24B4A" : "#B4B2A9";
      })
      .attr("stroke-width", d => {
        const key = `${d.source.id || d.source}|||${d.target.id || d.target}`;
        return attackEdgeSet.has(key) ? 2.5 : 1;
      })
      .attr("stroke-dasharray", d => {
        const key = `${d.source.id || d.source}|||${d.target.id || d.target}`;
        return attackEdgeSet.has(key) ? "6 3" : "none";
      })
      .attr("marker-end", d => {
        const key = `${d.source.id || d.source}|||${d.target.id || d.target}`;
        return `url(#arrow-${attackEdgeSet.has(key) ? "attack" : "default"})`;
      });

    // Node groups
    const node = g.append("g").selectAll("g")
      .data(graph.nodes).join("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end",   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Node shapes
    node.each(function(d) {
      const sel = d3.select(this);
      const color = RISK_COLOR[d.risk] || "#888780";
      const shape = TYPE_SHAPE[d.type] || "rect";

      if (shape === "circle") {
        sel.append("circle").attr("r", 18)
          .attr("fill", color + "22")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else if (shape === "diamond") {
        sel.append("polygon")
          .attr("points", "0,-20 20,0 0,20 -20,0")
          .attr("fill", color + "22")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else if (shape === "triangle") {
        sel.append("polygon")
          .attr("points", "0,-20 18,14 -18,14")
          .attr("fill", color + "22")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else {
        sel.append("rect")
          .attr("x", -22).attr("y", -14)
          .attr("width", 44).attr("height", 28)
          .attr("rx", 6)
          .attr("fill", color + "22")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      }

      // Risk badge for critical/high
      if (d.risk === "critical" || d.risk === "high") {
        sel.append("circle").attr("r", 6)
          .attr("cx", 18).attr("cy", -14)
          .attr("fill", RISK_COLOR[d.risk]);
      }
    });

    // Labels
    node.append("text")
      .attr("y", 28)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#5F5E5A")
      .text(d => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label);

    // Type label inside shape
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 9)
      .attr("fill", "#5F5E5A")
      .text(d => d.type.replace("_", " ").slice(0, 8));

    // Tooltip on hover
    const tooltip = d3.select("body").append("div")
      .style("position", "absolute")
      .style("background", "var(--color-background-secondary, #fff)")
      .style("border", "1px solid var(--color-border-tertiary, #ccc)")
      .style("border-radius", "8px")
      .style("padding", "8px 12px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0);

    node.on("mouseover", (e, d) => {
      tooltip.transition().duration(150).style("opacity", 1);
      tooltip.html(`
        <strong>${d.label}</strong><br/>
        Type: ${d.type}<br/>
        Risk: <span style="color:${RISK_COLOR[d.risk]}">${d.risk}</span><br/>
        ${d.public_ip ? `Public IP: ${d.public_ip}` : ""}
        ${d.is_public ? "<br/>⚠ Publicly accessible" : ""}
      `)
      .style("left", (e.pageX + 12) + "px")
      .style("top",  (e.pageY - 20) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [graph, attackPaths, highlightPaths]);

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    />
  );
}

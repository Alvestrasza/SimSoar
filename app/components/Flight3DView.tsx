"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {normalizeFlight3d, type Flight3dPoint} from "@/lib/flight-3d";

type Props = {points: Flight3dPoint[]; activeIndex: number; active: boolean};

type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  position: number;
  color: WebGLUniformLocation;
  pointSize: WebGLUniformLocation;
  count: number;
  vertices: number[];
};

const vertexShader = `
attribute vec3 a_position;
uniform float u_pointSize;
void main() {
  float yaw = -0.62;
  float rx = a_position.x * cos(yaw) - a_position.z * sin(yaw);
  float rz = a_position.x * sin(yaw) + a_position.z * cos(yaw);
  gl_Position = vec4(rx * 0.72, a_position.y * 0.72 + rz * 0.25, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}`;

const fragmentShader = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {gl.deleteShader(shader); return null;}
  return shader;
}

function buildProgram(gl: WebGLRenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {gl.deleteProgram(program); return null;}
  return program;
}

function draw(renderer: Renderer, activeIndex: number) {
  const {gl, program, buffer, position, color, pointSize, count, vertices} = renderer;
  const rect = gl.canvas instanceof HTMLCanvasElement ? gl.canvas.getBoundingClientRect() : {width: 720};
  const width = Math.max(320, Math.floor(rect.width || 720));
  const height = 360;
  const scale = window.devicePixelRatio || 1;
  gl.canvas.width = width * scale;
  gl.canvas.height = height * scale;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.035, 0.065, 0.12, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
  gl.uniform1f(pointSize, 1);
  gl.uniform4f(color, 0.22, 0.31, 0.43, 1);
  const ground = vertices.map((value, index) => index % 3 === 1 ? -0.55 : value);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ground), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.LINE_STRIP, 0, count);
  gl.uniform4f(color, 0.2, 0.72, 1, 1);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.LINE_STRIP, 0, count);
  const safeIndex = Math.max(0, Math.min(count - 1, activeIndex));
  const current = vertices.slice(safeIndex * 3, safeIndex * 3 + 3);
  const stem = [current[0], -0.55, current[2], ...current];
  gl.uniform4f(color, 0.96, 0.62, 0.07, 0.85);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(stem), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.LINES, 0, 2);
  gl.uniform1f(pointSize, 11 * scale);
  gl.uniform4f(color, 1, 0.72, 0.12, 1);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(current), gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.POINTS, 0, 1);
}

function Flight3DFallback({points, activeIndex}: Omit<Props, "active">) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 720));
    const height = 300;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale; canvas.height = height * scale; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.scale(scale, scale);
    ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, width, height);
    const minLat = Math.min(...points.map((point) => point.lat)); const maxLat = Math.max(...points.map((point) => point.lat));
    const minLon = Math.min(...points.map((point) => point.lon)); const maxLon = Math.max(...points.map((point) => point.lon));
    const x = (lon: number) => 16 + (lon - minLon) / (maxLon - minLon || 1) * (width - 32);
    const y = (lat: number) => height - 16 - (lat - minLat) / (maxLat - minLat || 1) * (height - 32);
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(x(point.lon), y(point.lat)) : ctx.moveTo(x(point.lon), y(point.lat)));
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.stroke();
    const current = points[Math.max(0, Math.min(points.length - 1, activeIndex))];
    ctx.beginPath(); ctx.arc(x(current.lon), y(current.lat), 6, 0, Math.PI * 2); ctx.fillStyle = "#f59e0b"; ctx.fill();
  }, [points, activeIndex]);
  return <canvas ref={canvasRef} className="flight3dCanvas" />;
}

export default function Flight3DView({points, activeIndex, active}: Props) {
  const t = useTranslations("FlightDetail");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const [fallback, setFallback] = useState(false);
  const normalized = useMemo(() => normalizeFlight3d(points), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalized.vertices.length < 6) return;
    const gl = canvas.getContext("webgl", {antialias: true, alpha: false});
    if (!gl) {setFallback(true); return;}
    const program = buildProgram(gl); const buffer = gl.createBuffer();
    if (!program || !buffer) {setFallback(true); return;}
    const position = gl.getAttribLocation(program, "a_position");
    const color = gl.getUniformLocation(program, "u_color");
    const pointSize = gl.getUniformLocation(program, "u_pointSize");
    if (position < 0 || !color || !pointSize) {setFallback(true); return;}
    const handleContextLost = (event: Event) => {event.preventDefault(); setFallback(true);};
    canvas.addEventListener("webglcontextlost", handleContextLost);
    rendererRef.current = {gl, program, buffer, position, color, pointSize, count: normalized.vertices.length / 3, vertices: normalized.vertices};
    draw(rendererRef.current, activeIndex);
    const resize = () => rendererRef.current && draw(rendererRef.current, activeIndexRef.current);
    window.addEventListener("resize", resize);
    return () => {window.removeEventListener("resize", resize); canvas.removeEventListener("webglcontextlost", handleContextLost); rendererRef.current = null; gl.deleteBuffer(buffer); gl.deleteProgram(program);};
  }, [normalized]);

  useEffect(() => {if (active && rendererRef.current) draw(rendererRef.current, activeIndex);}, [active, activeIndex]);

  if (points.length < 2) return <p className="muted">{t("replayUnavailable")}</p>;
  if (fallback) return <div><p className="muted">{t("flight3dFallback")}</p><Flight3DFallback points={points} activeIndex={activeIndex} /></div>;
  return <div className="flight3dShell"><canvas ref={canvasRef} className="flight3dCanvas" aria-label={t("flight3dLabel")} /><div className="flight3dAltitude"><span>{normalized.maxAltitudeM} m</span><span>{normalized.minAltitudeM} m</span></div></div>;
}

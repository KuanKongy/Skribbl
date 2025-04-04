
import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Eraser, Trash2, MousePointer2, PaintBucket } from 'lucide-react';

interface CanvasProps {
  isDrawing: boolean;
  onDrawingUpdate?: (imageData: string) => void;
}

const Canvas: React.FC<CanvasProps> = ({ isDrawing, onDrawingUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');
  
  // Mouse / touch positions
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Adjust canvas size
        const updateSize = () => {
          const parent = canvas.parentElement;
          if (parent) {
            const { width, height } = parent.getBoundingClientRect();
            canvas.width = width;
            canvas.height = height;
            context.lineCap = 'round';
            context.lineJoin = 'round';
          }
        };
        
        window.addEventListener('resize', updateSize);
        updateSize();
        
        setCtx(context);
        
        return () => {
          window.removeEventListener('resize', updateSize);
        };
      }
    }
  }, []);

  // Enable/disable drawing based on props
  useEffect(() => {
    setIsDrawingEnabled(isDrawing);
  }, [isDrawing]);

  // Drawing functions
  const startDrawing = (x: number, y: number) => {
    if (!isDrawingEnabled || !ctx) return;
    
    if (tool === 'fill') {
      floodFill(x, y);
      return;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setLastPos({ x, y });
    
    if (tool === 'brush') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    } else {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = brushSize * 2;
    }
  };

  const draw = (x: number, y: number) => {
    if (!isDrawingEnabled || !ctx || tool === 'fill') return;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setLastPos({ x, y });
    
    // If onDrawingUpdate is provided, send the image data
    if (onDrawingUpdate && canvasRef.current) {
      onDrawingUpdate(canvasRef.current.toDataURL());
    }
  };

  // Flood fill implementation
  const floodFill = (x: number, y: number) => {
    if (!isDrawingEnabled || !ctx || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const stack = [{x, y}];
    
    // Get the target color (the color at the click point)
    const targetColorPos = (Math.floor(y) * width + Math.floor(x)) * 4;
    const targetR = data[targetColorPos];
    const targetG = data[targetColorPos + 1];
    const targetB = data[targetColorPos + 2];
    const targetA = data[targetColorPos + 3];
    
    // Parse the fill color
    const fillColorObj = hexToRgba(color);
    
    // Check if target color is already the fill color
    if (
      targetR === fillColorObj.r &&
      targetG === fillColorObj.g &&
      targetB === fillColorObj.b &&
      targetA === 255
    ) {
      return;
    }
    
    while (stack.length) {
      const pos = stack.pop()!;
      const px = Math.floor(pos.x);
      const py = Math.floor(pos.y);
      
      // Check bounds
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      
      const dataPos = (py * width + px) * 4;
      
      // Check if this pixel matches the target color
      if (
        data[dataPos] !== targetR ||
        data[dataPos + 1] !== targetG ||
        data[dataPos + 2] !== targetB ||
        data[dataPos + 3] !== targetA
      ) {
        continue;
      }
      
      // Set the pixel to the fill color
      data[dataPos] = fillColorObj.r;
      data[dataPos + 1] = fillColorObj.g;
      data[dataPos + 2] = fillColorObj.b;
      data[dataPos + 3] = 255;
      
      // Add neighboring pixels to the stack
      stack.push({x: px + 1, y: py});
      stack.push({x: px - 1, y: py});
      stack.push({x: px, y: py + 1});
      stack.push({x: px, y: py - 1});
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
    
    // If onDrawingUpdate is provided, send the image data
    if (onDrawingUpdate) {
      onDrawingUpdate(canvas.toDataURL());
    }
  };

  const hexToRgba = (hex: string) => {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return { r, g, b, a: 255 };
  };

  const clearCanvas = () => {
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (onDrawingUpdate) {
        onDrawingUpdate(canvasRef.current.toDataURL());
      }
    }
  };

  // Event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startDrawing(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (e.buttons !== 1) return; // Only draw when primary mouse button is down
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    draw(x, y);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    startDrawing(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    draw(x, y);
  };

  // Color options - expanded with more colors
  const colorOptions = [
    '#000000', '#FFFFFF', '#FF0000', '#FF8000', '#FFFF00', 
    '#80FF00', '#00FF00', '#00FF80', '#00FFFF', '#0080FF', 
    '#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#964B00',
    '#808080', '#C0C0C0', '#FFC0CB', '#800000', '#008000'
  ];

  return (
    <div className="flex flex-col w-full h-full gap-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            className="flex items-center"
            title="Brush"
          >
            <Palette className="h-4 w-4 mr-1" />
            <span className="sr-only md:not-sr-only md:inline-block">Brush</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            className="flex items-center"
            title="Eraser"
          >
            <Eraser className="h-4 w-4 mr-1" />
            <span className="sr-only md:not-sr-only md:inline-block">Eraser</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'fill' ? 'default' : 'outline'}
            onClick={() => setTool('fill')}
            className="flex items-center"
            title="Fill"
          >
            <PaintBucket className="h-4 w-4 mr-1" />
            <span className="sr-only md:not-sr-only md:inline-block">Fill</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearCanvas}
            className="flex items-center"
            title="Clear Canvas"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="sr-only md:not-sr-only md:inline-block">Clear</span>
          </Button>
        </div>
        
        {/* Color picker */}
        <div className="flex flex-wrap items-center gap-1 max-w-[50%]">
          {colorOptions.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full border-2 ${
                color === c ? 'border-gray-800' : 'border-gray-300'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              title={`Color ${c}`}
            />
          ))}
          {/* Brush size slider */}
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20 ml-2"
            title="Brush Size"
          />
        </div>
      </div>
      
      <div className="flex-1 canvas-container relative">
        {!isDrawingEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg z-10">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <MousePointer2 className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm">Waiting for your turn...</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        />
      </div>
    </div>
  );
};

export default Canvas;

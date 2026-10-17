import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  /** Valor del código de barras a renderizar */
  value: string;
  /** Ancho en píxeles del elemento SVG (default: 150) */
  width?: number;
  /** Alto en píxeles de las barras (default: 50) */
  height?: number;
  /** Mostrar texto del valor debajo del barcode (default: true) */
  displayValue?: boolean;
  /** Tamaño de fuente del texto (default: 10) */
  fontSize?: number;
  /** Clase CSS adicional para el wrapper */
  className?: string;
}

export interface BarcodeDisplayHandle {
  getSvgElement: () => SVGSVGElement | null;
}

/**
 * Renderiza un código de barras CODE128 como SVG usando JsBarcode.
 * Expone el SVGElement via ref para permitir descarga externa.
 * Si el valor está vacío o tiene formato inválido, no renderiza nada.
 */
export const BarcodeDisplay = forwardRef<BarcodeDisplayHandle, BarcodeDisplayProps>(
  (
    {
      value,
      width = 150,
      height = 50,
      displayValue = true,
      fontSize = 10,
      className = '',
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useImperativeHandle(ref, () => ({
      getSvgElement: () => svgRef.current,
    }));

    useEffect(() => {
      if (!svgRef.current || !value || value.trim() === '') return;

      try {
        JsBarcode(svgRef.current, value.trim(), {
          format: 'CODE128',
          width: 1.5,
          height,
          displayValue,
          fontSize,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        // Valor inválido para CODE128 — limpiar silenciosamente
        if (svgRef.current) {
          svgRef.current.innerHTML = '';
        }
      }
    }, [value, height, displayValue, fontSize]);

    if (!value || value.trim() === '') return null;

    return (
      <div className={`inline-block ${className}`} style={{ maxWidth: width }}>
        <svg ref={svgRef} style={{ width: '100%', height: 'auto' }} />
      </div>
    );
  }
);

BarcodeDisplay.displayName = 'BarcodeDisplay';

/**
 * Descarga el barcode como imagen PNG a partir de un SVGElement.
 * Escala 3x para asegurar alta resolución (apto para impresión).
 * @param svgElement - El SVGElement generado por BarcodeDisplay
 * @param filename - Nombre del archivo sin extensión
 */
export function downloadBarcodeAsPng(svgElement: SVGSVGElement, filename: string): void {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const scale = 3; // 3x para alta resolución
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = pngUrl;
    link.click();
  };

  img.src = url;
}

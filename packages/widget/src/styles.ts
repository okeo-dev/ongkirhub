export function getStyles(prefix: string): string {
  return `
.${prefix} {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 420px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.${prefix} fieldset {
  border: none;
  padding: 0;
  margin: 0 0 12px;
}
.${prefix} label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #374151;
}
.${prefix} input[type="text"],
.${prefix} input[type="number"] {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.${prefix} button {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.${prefix} button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.${prefix}-error {
  margin-top: 10px;
  padding: 10px;
  font-size: 14px;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}
.${prefix}-results {
  margin-top: 12px;
}
.${prefix}-result {
  padding: 10px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}
.${prefix}-result-name {
  font-weight: 600;
  font-size: 14px;
}
.${prefix}-result-meta {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}
`;
}

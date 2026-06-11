import type { WidgetLabels } from "./types.js";

export function createInput(
  id: string,
  label: string,
  type: string,
  value: string,
): HTMLElement {
  const fieldset = document.createElement("fieldset");
  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.id = id;
  input.value = value;
  fieldset.appendChild(labelEl);
  fieldset.appendChild(input);
  return fieldset;
}

export function createForm(
  prefix: string,
  labels: WidgetLabels,
  defaultOriginPostal: string,
  defaultDestPostal: string,
): HTMLElement {
  const form = document.createElement("form");
  form.className = `${prefix}-form`;
  form.appendChild(
    createInput(
      `${prefix}-origin`,
      labels.originPostalCode,
      "text",
      defaultOriginPostal,
    ),
  );
  form.appendChild(
    createInput(
      `${prefix}-destination`,
      labels.destinationPostalCode,
      "text",
      defaultDestPostal,
    ),
  );
  form.appendChild(
    createInput(`${prefix}-weight`, labels.weight, "number", "1000"),
  );

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = labels.submit;
  form.appendChild(submit);

  return form;
}

export function createErrorElement(prefix: string, message: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `${prefix}-error`;
  el.textContent = message;
  return el;
}

export function createResultsElement(
  prefix: string,
  quotes: Array<{
    serviceName: string;
    providerKey: string;
    price: { amount: number; currency: string };
    estimatedDuration?: { value: number; unit: string } | null;
  }>,
): HTMLElement {
  const container = document.createElement("div");
  container.className = `${prefix}-results`;

  for (const quote of quotes) {
    const row = document.createElement("div");
    row.className = `${prefix}-result`;

    const name = document.createElement("div");
    name.className = `${prefix}-result-name`;
    name.textContent = `${quote.serviceName} — ${quote.providerKey}`;

    const meta = document.createElement("div");
    meta.className = `${prefix}-result-meta`;
    const duration = quote.estimatedDuration
      ? `${quote.estimatedDuration.value} ${quote.estimatedDuration.unit}`
      : "N/A";
    meta.textContent = `${quote.price.amount.toLocaleString()} ${quote.price.currency} · ${duration}`;

    row.appendChild(name);
    row.appendChild(meta);
    container.appendChild(row);
  }

  return container;
}

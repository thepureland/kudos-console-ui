const FORM_ERROR_SELECTOR = '.el-form .el-form-item__error:not(.el-form-item__error--inline)';
const TOOLTIP_OFFSET = 8;

let activeTooltip: HTMLDivElement | null = null;

function getErrorMessage(node: HTMLElement): string {
  return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
}

function ensureTooltipElement(): HTMLDivElement {
  if (activeTooltip) return activeTooltip;
  let tooltip = document.querySelector<HTMLDivElement>('.form-error-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'form-error-tooltip';
    document.body.appendChild(tooltip);
  }
  activeTooltip = tooltip;
  return tooltip;
}

function hideTooltip(): void {
  ensureTooltipElement().classList.remove('is-visible');
}

function isTextTruncated(node: HTMLElement): boolean {
  return node.scrollWidth > node.clientWidth;
}

function syncErrorTooltipForNode(node: HTMLElement): void {
  const message = getErrorMessage(node);
  if (message && isTextTruncated(node)) {
    node.setAttribute('data-error-tooltip', message);
    node.setAttribute('aria-label', message);
  } else {
    node.removeAttribute('data-error-tooltip');
    node.removeAttribute('aria-label');
    if (node.dataset.tooltipBound === 'true') hideTooltip();
  }
}

function syncErrorTooltip(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches(FORM_ERROR_SELECTOR)) {
    syncErrorTooltipForNode(root);
  }

  const nodes = root.querySelectorAll<HTMLElement>(FORM_ERROR_SELECTOR);
  nodes.forEach((node) => {
    syncErrorTooltipForNode(node);
  });
}

function positionTooltip(target: HTMLElement, tooltip: HTMLDivElement): void {
  const rect = target.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  tooltip.classList.add('is-visible');

  const tipRect = tooltip.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + TOOLTIP_OFFSET;

  if (left + tipRect.width > viewportWidth - TOOLTIP_OFFSET) left = viewportWidth - tipRect.width - TOOLTIP_OFFSET;
  if (left < TOOLTIP_OFFSET) left = TOOLTIP_OFFSET;
  if (top + tipRect.height > viewportHeight - TOOLTIP_OFFSET) top = rect.top - tipRect.height - TOOLTIP_OFFSET;
  if (top < TOOLTIP_OFFSET) top = TOOLTIP_OFFSET;

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function showTooltip(node: HTMLElement): void {
  const message = node.getAttribute('data-error-tooltip')?.trim();
  if (!message || !isTextTruncated(node)) return;
  const tooltip = ensureTooltipElement();
  tooltip.textContent = message;
  positionTooltip(node, tooltip);
}

function bindTooltipEvents(node: HTMLElement): void {
  if (node.dataset.tooltipBound === 'true') return;

  node.addEventListener('mouseenter', () => {
    showTooltip(node);
  });
  node.addEventListener('mouseleave', () => {
    hideTooltip();
  });
  node.addEventListener('mousemove', () => {
    if (ensureTooltipElement().classList.contains('is-visible')) showTooltip(node);
  });

  node.dataset.tooltipBound = 'true';
}

export function installFormErrorTooltip(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureTooltipElement();
  requestAnimationFrame(() => {
    syncErrorTooltip();
    document.querySelectorAll<HTMLElement>(FORM_ERROR_SELECTOR).forEach((node) => bindTooltipEvents(node));
  });

  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', () => {
    hideTooltip();
    syncErrorTooltip();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentNode;
        if (parent instanceof HTMLElement && parent.matches('.el-form-item__error')) {
          bindTooltipEvents(parent);
          requestAnimationFrame(() => syncErrorTooltipForNode(parent));
          return;
        }
        continue;
      }

      if (mutation.type === 'childList') {
        const mutationTarget = mutation.target;
        if (mutationTarget instanceof HTMLElement && mutationTarget.matches('.el-form-item__error')) {
          bindTooltipEvents(mutationTarget);
          requestAnimationFrame(() => syncErrorTooltipForNode(mutationTarget));
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('.el-form-item__error')) {
            bindTooltipEvents(node);
            requestAnimationFrame(() => syncErrorTooltipForNode(node));
          } else {
            requestAnimationFrame(() => syncErrorTooltip(node));
            node.querySelectorAll<HTMLElement>('.el-form-item__error').forEach((errorNode) => {
              bindTooltipEvents(errorNode);
              requestAnimationFrame(() => syncErrorTooltipForNode(errorNode));
            });
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

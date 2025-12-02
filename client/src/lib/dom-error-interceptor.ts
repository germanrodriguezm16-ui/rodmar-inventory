// DOM Error Interceptor to prevent React errors from breaking the application
export function initializeDOMErrorInterceptor() {
  // Override Node.removeChild to catch and suppress errors
  if (typeof Node !== 'undefined' && Node.prototype.removeChild) {
    const originalRemoveChild = Node.prototype.removeChild;
    
    Node.prototype.removeChild = function(child: Node) {
      try {
        return originalRemoveChild.call(this, child);
      } catch (error: any) {
        // Silently handle the error and return null to prevent crashes
        console.log('DOM removeChild error intercepted and suppressed');
        return child;
      }
    };
  }

  // Override appendChild to be more defensive
  if (typeof Node !== 'undefined' && Node.prototype.appendChild) {
    const originalAppendChild = Node.prototype.appendChild;
    
    Node.prototype.appendChild = function(child: Node) {
      try {
        return originalAppendChild.call(this, child);
      } catch (error: any) {
        console.log('DOM appendChild error intercepted and suppressed');
        return child;
      }
    };
  }

  // Override insertBefore to be more defensive
  if (typeof Node !== 'undefined' && Node.prototype.insertBefore) {
    const originalInsertBefore = Node.prototype.insertBefore;
    
    Node.prototype.insertBefore = function(newNode: Node, referenceNode: Node | null) {
      try {
        return originalInsertBefore.call(this, newNode, referenceNode);
      } catch (error: any) {
        console.log('DOM insertBefore error intercepted and suppressed');
        return newNode;
      }
    };
  }

  // Override querySelector to be more defensive
  if (typeof Document !== 'undefined' && Document.prototype.querySelector) {
    const originalQuerySelector = Document.prototype.querySelector;
    
    Document.prototype.querySelector = function(selectors: string) {
      try {
        return originalQuerySelector.call(this, selectors);
      } catch (error: any) {
        console.log('DOM querySelector error intercepted and suppressed');
        return null;
      }
    };
  }

  // Override getElementById to be more defensive
  if (typeof Document !== 'undefined' && Document.prototype.getElementById) {
    const originalGetElementById = Document.prototype.getElementById;
    
    Document.prototype.getElementById = function(elementId: string) {
      try {
        return originalGetElementById.call(this, elementId);
      } catch (error: any) {
        console.log('DOM getElementById error intercepted and suppressed');
        return null;
      }
    };
  }
}
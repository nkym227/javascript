case 'outerhtml':
case 'outer':
    const elementsToInsert = Array.from(tempDiv.childNodes).filter(node => 
        node.nodeType === Node.ELEMENT_NODE || 
        (node.nodeType === Node.TEXT_NODE && node.textContent.trim())
    );
    
    if (elementsToInsert.length === 0) {
        throw new Error('No valid elements found in HTML content');
    }
    
    try {
        const currentParent = element.parentNode;
        const currentNext = element.nextSibling;
        
        // 元の要素を削除
        element.remove();
        
        // 複数要素を順次挿入
        elementsToInsert.forEach(elementToInsert => {
            if (currentNext && currentNext.parentNode) {
                currentParent.insertBefore(elementToInsert, currentNext);
            } else {
                currentParent.appendChild(elementToInsert);
            }
        });
        
        // 最後に挿入された要素を newElement とする
        newElement = elementsToInsert[elementsToInsert.length - 1];
        newParent = newElement.parentNode;
        newNext = newElement.nextSibling;
    } catch (error) {
        throw new Error(`Failed to replace element: ${error.message}`);
    }
    break;

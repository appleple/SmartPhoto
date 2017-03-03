module.exports.addClass = (element, className) => {
	if(element.classList){
		element.classList.add(className);
	}else {
		if(element.className){
			element.className += ' '+ className;
		}else{
			element.className = className;
		}
	}
}

module.exports.remove = (element) => {
	element.parentNode.removeChild(element);
}

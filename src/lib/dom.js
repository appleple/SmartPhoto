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

module.exports.hasClass = (element, className) => {
	if(element.classList){
		return element.classList.contains(className);
	}else {
		return new RegExp('(^| )' + className + '( |$)', 'gi').test(el.className);
	}
}

module.exports.remove = (element) => {
	element.parentNode.removeChild(element);
}

import * as vscode from 'vscode';

const regexFuncLine = /func\s*\([^)]*\).*/;
const regexErrorLine = /\w+,\s+\w+\s+:=\s+.*\)/
const regexFuncName = /\)\s*\w+\s*\(/
const regexReturnParams = /(?:[\w+,*\[\],\.](?:,\s*)?)+\s*\)\s*\{|(?:[\w+,*\[\],\.](?:,\s*)?)+\s*\{/

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('errorhandlergenerator.errh', () => {
		const editor = vscode.window.activeTextEditor;

		const reciverName = getErrorHandler();

		editor?.insertSnippet(new vscode.SnippetString(reciverName));
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

function getErrorHandler(): string {
	const errorLine = getMatchLine(regexErrorLine);
	const funcLine = getMatchLine(regexFuncLine);

	const reciverName = getReciverName(funcLine);
	const gloabalFuncName = getGlobalFuncName(funcLine);

	const errName = getErrorName(errorLine);
	const localFuncName = getLocalFunctionName(errorLine);

	const returnParamsCount = getReturnParamsCount(funcLine);

	const packageName = getPackageNameByReciverName(reciverName);

	let errorHandler = 'if ' + errName + ' != nil {\n\t' + reciverName + '.logger.Error().Err(' + errName + ').Msg("error ' + packageName + ' ' + gloabalFuncName + '.' + localFuncName + '")\n';

	switch (reciverName) {
		case 's':
			if (errName == 'errApp') {
				errorHandler += '\tapi_utils.ErrorResponse(cgin, s.ErrorHandler(' + errName + '))\n';
			}
			else {
				errorHandler += '\tapi_utils.ErrorResponse(cgin, ' + errName + ')\n';
			}
			errorHandler += '\treturn\n';
			break;
		case 'a' || 'm':
			errorHandler += '\treturn '
			let paramsCountApp = returnParamsCount;

			if (paramsCountApp == 0) {
				errorHandler += '\n'
				break;
			}

			while (paramsCountApp > 0) {
				errorHandler += 'nil, ';
				paramsCountApp--;
			}

			if (errName == 'errRepo') {
				errorHandler += errName + ' // need to handle'
			} else if (errName != 'err') {
				errorHandler += errName
			}

			errorHandler += '\n';

			break;
		case 'r':
			errorHandler += '\treturn '
			let paramsCountRepo = returnParamsCount;
			
			if (paramsCountRepo == 0) {
				errorHandler += '\n'
				break;
			}

			while (paramsCountRepo > 0) {
				errorHandler += 'nil, ';
				paramsCountRepo--;
			}

			errorHandler += 'r.ErrorHandler(' + errName + ')\n';
			break;
	}

	errorHandler += '}';

	return errorHandler;
}

function getMatchLine(regex: RegExp): string {
	const editor = vscode.window.activeTextEditor;

	if (editor) {
		const position = editor.selection.active;
		const currentLine = position.line;
		let lineIndex = currentLine;

		while (lineIndex >= 0) {
			const line = editor.document.lineAt(lineIndex);
			const lineText = line.text;
			const match = regex.exec(lineText);

			console.log(match);
			if (match && match.length >= 1) {
				return match[0];
			}

			lineIndex--;
		}
	}

	return '';
}

function getReciverName(line: string): string {
	const splitedLine = line.split('(');
	let reciver = splitedLine[1];
	reciver = reciver.trim();
	const splitReciver = reciver.split(' ');
	const reciverName = splitReciver[0];

	return reciverName;
}

function getErrorName(line : string) : string {
	let splitedLine = line.split('=');
	let errName = '';

	if (splitedLine.length == 0) {
		return '';
	}

	splitedLine = splitedLine[0].split(',');
	if (splitedLine.length == 0) {
		return '';
	}

	errName = splitedLine[splitedLine.length - 1];
	if (errName != '' && errName[errName.length - 1] == ':') {
		errName = errName.slice(0, -1).trim();
	}

	return errName;
}

// func (s *server) test() error {}
// func(s *server) test() error {}
// func(s *server)test() error {}
function getGlobalFuncName(line: string): string {
	const match = regexFuncName.exec(line);
	let funcName = ''

	if (match && match.length > 0) {
		funcName = match[0]
		funcName = funcName.slice(1, -1);
		funcName = funcName.trim();
	}


	return funcName;
}

function getLocalFunctionName(line: string): string {
	let splitedLine = line.split('=')//[1].trim().split('.');
	if (splitedLine.length < 2) {
		return ''
	}

	let funcNames = splitedLine[1].trim();
	let splitFuncNames = funcNames.split('.')

	let funcName = splitFuncNames[splitFuncNames.length - 1].trim();
	funcName = funcName.split('(')[0].trim()

	return funcName;
}

function getReturnParamsCount(line: string): number {
	const match = regexReturnParams.exec(line);

	if (match) {
		return match[0].split(',').length - 1;
	}

	return 0
}

function getPackageNameByReciverName(reciverName: string): string {
	switch (reciverName) {
		case 's':
			return 'api';
		case 'a':
			return 'app';
		case 'r':
			return 'repo';
		default:
			return 'unknown';
	}
}

//TODO:
// arr, err := test().
//	Select().
//	ToSql()
// в таком примере в лог пишется функция test(), должно ToSql()

// если  в сервисной ручке, вызываемая функция является сервисной, то просто возвращаем ошибку
// если не сервисная делаем обработку

// вероятно, если в функции будет анонимная функция, то все обработка ошибок ниже анонимной функции не сработают корректно

// если на репо уровне один возвращаемый параметр, то в ретурн она не обрабатывается
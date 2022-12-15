// Generated from MalloyParser.g4 by ANTLR 4.9.0-SNAPSHOT


import { ATN } from "antlr4ts/atn/ATN";
import { ATNDeserializer } from "antlr4ts/atn/ATNDeserializer";
import { FailedPredicateException } from "antlr4ts/FailedPredicateException";
import { NotNull } from "antlr4ts/Decorators";
import { NoViableAltException } from "antlr4ts/NoViableAltException";
import { Override } from "antlr4ts/Decorators";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParserATNSimulator } from "antlr4ts/atn/ParserATNSimulator";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { RuleContext } from "antlr4ts/RuleContext";
//import { RuleVersion } from "antlr4ts/RuleVersion";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Token } from "antlr4ts/Token";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { VocabularyImpl } from "antlr4ts/VocabularyImpl";

import * as Utils from "antlr4ts/misc/Utils";

import { MalloyParserListener } from "./MalloyParserListener";
import { MalloyParserVisitor } from "./MalloyParserVisitor";


export class MalloyParser extends Parser {
	public static readonly JSON_STRING = 1;
	public static readonly ACCEPT = 2;
	public static readonly AGGREGATE = 3;
	public static readonly CONNECTION = 4;
	public static readonly DECLARE = 5;
	public static readonly DIMENSION = 6;
	public static readonly EXCEPT = 7;
	public static readonly EXPLORE = 8;
	public static readonly GROUP_BY = 9;
	public static readonly HAVING = 10;
	public static readonly INDEX = 11;
	public static readonly JOIN_CROSS = 12;
	public static readonly JOIN_ONE = 13;
	public static readonly JOIN_MANY = 14;
	public static readonly LIMIT = 15;
	public static readonly MEASURE = 16;
	public static readonly NEST = 17;
	public static readonly ORDER_BY = 18;
	public static readonly PRIMARY_KEY = 19;
	public static readonly PROJECT = 20;
	public static readonly QUERY = 21;
	public static readonly RENAME = 22;
	public static readonly SAMPLE = 23;
	public static readonly SELECT = 24;
	public static readonly SOURCE = 25;
	public static readonly SQL = 26;
	public static readonly FANCYSQL = 27;
	public static readonly TOP = 28;
	public static readonly WHERE = 29;
	public static readonly ALL = 30;
	public static readonly AND = 31;
	public static readonly AS = 32;
	public static readonly ASC = 33;
	public static readonly AVG = 34;
	public static readonly BOOLEAN = 35;
	public static readonly BY = 36;
	public static readonly CASE = 37;
	public static readonly CAST = 38;
	public static readonly CONDITION = 39;
	public static readonly COUNT = 40;
	public static readonly DATE = 41;
	public static readonly DAY = 42;
	public static readonly DESC = 43;
	public static readonly DISTINCT = 44;
	public static readonly ELSE = 45;
	public static readonly END = 46;
	public static readonly EXCLUDE = 47;
	public static readonly FALSE = 48;
	public static readonly FOR = 49;
	public static readonly FROM = 50;
	public static readonly FROM_SQL = 51;
	public static readonly HAS = 52;
	public static readonly HOUR = 53;
	public static readonly IMPORT = 54;
	public static readonly IS = 55;
	public static readonly JSON = 56;
	public static readonly LAST = 57;
	public static readonly MAX = 58;
	public static readonly MIN = 59;
	public static readonly MINUTE = 60;
	public static readonly MONTH = 61;
	public static readonly NOT = 62;
	public static readonly NOW = 63;
	public static readonly NULL = 64;
	public static readonly NUMBER = 65;
	public static readonly ON = 66;
	public static readonly OR = 67;
	public static readonly PICK = 68;
	public static readonly QMARK = 69;
	public static readonly QUARTER = 70;
	public static readonly SECOND = 71;
	public static readonly STRING = 72;
	public static readonly SUM = 73;
	public static readonly TABLE = 74;
	public static readonly THEN = 75;
	public static readonly THIS = 76;
	public static readonly TIMESTAMP = 77;
	public static readonly TO = 78;
	public static readonly TRUE = 79;
	public static readonly TURTLE = 80;
	public static readonly WEEK = 81;
	public static readonly WHEN = 82;
	public static readonly WITH = 83;
	public static readonly YEAR = 84;
	public static readonly UNGROUPED = 85;
	public static readonly STRING_ESCAPE = 86;
	public static readonly HACKY_REGEX = 87;
	public static readonly STRING_LITERAL = 88;
	public static readonly AMPER = 89;
	public static readonly ARROW = 90;
	public static readonly FAT_ARROW = 91;
	public static readonly OPAREN = 92;
	public static readonly CPAREN = 93;
	public static readonly OBRACK = 94;
	public static readonly CBRACK = 95;
	public static readonly OCURLY = 96;
	public static readonly CCURLY = 97;
	public static readonly DOUBLECOLON = 98;
	public static readonly COLON = 99;
	public static readonly COMMA = 100;
	public static readonly DOT = 101;
	public static readonly LT = 102;
	public static readonly GT = 103;
	public static readonly EQ = 104;
	public static readonly NE = 105;
	public static readonly LTE = 106;
	public static readonly GTE = 107;
	public static readonly PLUS = 108;
	public static readonly MINUS = 109;
	public static readonly STAR = 110;
	public static readonly STARSTAR = 111;
	public static readonly SLASH = 112;
	public static readonly BAR = 113;
	public static readonly SEMI = 114;
	public static readonly NOT_MATCH = 115;
	public static readonly MATCH = 116;
	public static readonly PERCENT = 117;
	public static readonly LITERAL_TIMESTAMP = 118;
	public static readonly LITERAL_DAY = 119;
	public static readonly LITERAL_QUARTER = 120;
	public static readonly LITERAL_MONTH = 121;
	public static readonly LITERAL_WEEK = 122;
	public static readonly LITERAL_YEAR = 123;
	public static readonly IDENTIFIER = 124;
	public static readonly PERCENT_LITERAL = 125;
	public static readonly INTEGER_LITERAL = 126;
	public static readonly NUMERIC_LITERAL = 127;
	public static readonly OBJECT_NAME_LITERAL = 128;
	public static readonly BLOCK_COMMENT = 129;
	public static readonly COMMENT_TO_EOL = 130;
	public static readonly WHITE_SPACE = 131;
	public static readonly SQL_BEGIN = 132;
	public static readonly CLOSE_CODE = 133;
	public static readonly UNWATED_CHARS_TRAILING_NUMBERS = 134;
	public static readonly UNEXPECTED_CHAR = 135;
	public static readonly OPEN_CODE = 136;
	public static readonly SQL_END = 137;
	public static readonly RULE_malloyDocument = 0;
	public static readonly RULE_malloyStatement = 1;
	public static readonly RULE_defineExploreStatement = 2;
	public static readonly RULE_exploreKeyword = 3;
	public static readonly RULE_defineQuery = 4;
	public static readonly RULE_topLevelAnonQueryDef = 5;
	public static readonly RULE_defineSQLStatement = 6;
	public static readonly RULE_sqlBlock = 7;
	public static readonly RULE_blockSQLDef = 8;
	public static readonly RULE_sqlString = 9;
	public static readonly RULE_sqlInterpolation = 10;
	public static readonly RULE_importStatement = 11;
	public static readonly RULE_importURL = 12;
	public static readonly RULE_topLevelQueryDefs = 13;
	public static readonly RULE_topLevelQueryDef = 14;
	public static readonly RULE_refineOperator = 15;
	public static readonly RULE_query = 16;
	public static readonly RULE_pipelineFromName = 17;
	public static readonly RULE_firstSegment = 18;
	public static readonly RULE_pipeElement = 19;
	public static readonly RULE_exploreTable = 20;
	public static readonly RULE_queryProperties = 21;
	public static readonly RULE_filterShortcut = 22;
	public static readonly RULE_exploreQueryName = 23;
	public static readonly RULE_queryName = 24;
	public static readonly RULE_exploreDefinitionList = 25;
	public static readonly RULE_exploreDefinition = 26;
	public static readonly RULE_explore = 27;
	public static readonly RULE_exploreSource = 28;
	public static readonly RULE_exploreNameDef = 29;
	public static readonly RULE_exploreName = 30;
	public static readonly RULE_exploreProperties = 31;
	public static readonly RULE_exploreStatement = 32;
	public static readonly RULE_renameList = 33;
	public static readonly RULE_exploreRenameDef = 34;
	public static readonly RULE_dimensionDefList = 35;
	public static readonly RULE_measureDefList = 36;
	public static readonly RULE_fieldDef = 37;
	public static readonly RULE_fieldNameDef = 38;
	public static readonly RULE_joinNameDef = 39;
	public static readonly RULE_measureDef = 40;
	public static readonly RULE_declareStatement = 41;
	public static readonly RULE_joinStatement = 42;
	public static readonly RULE_joinList = 43;
	public static readonly RULE_joinDef = 44;
	public static readonly RULE_joinExpression = 45;
	public static readonly RULE_filterStatement = 46;
	public static readonly RULE_filteredBy = 47;
	public static readonly RULE_filterClauseList = 48;
	public static readonly RULE_whereStatement = 49;
	public static readonly RULE_havingStatement = 50;
	public static readonly RULE_subQueryDefList = 51;
	public static readonly RULE_exploreQueryNameDef = 52;
	public static readonly RULE_exploreQueryDef = 53;
	public static readonly RULE_queryStatement = 54;
	public static readonly RULE_groupByStatement = 55;
	public static readonly RULE_queryFieldList = 56;
	public static readonly RULE_dimensionDef = 57;
	public static readonly RULE_queryFieldEntry = 58;
	public static readonly RULE_nestStatement = 59;
	public static readonly RULE_nestedQueryList = 60;
	public static readonly RULE_nestEntry = 61;
	public static readonly RULE_aggregateStatement = 62;
	public static readonly RULE_projectStatement = 63;
	public static readonly RULE_orderByStatement = 64;
	public static readonly RULE_ordering = 65;
	public static readonly RULE_orderBySpec = 66;
	public static readonly RULE_limitStatement = 67;
	public static readonly RULE_bySpec = 68;
	public static readonly RULE_topStatement = 69;
	public static readonly RULE_indexElement = 70;
	public static readonly RULE_indexFields = 71;
	public static readonly RULE_indexStatement = 72;
	public static readonly RULE_sampleStatement = 73;
	public static readonly RULE_sampleSpec = 74;
	public static readonly RULE_aggregate = 75;
	public static readonly RULE_malloyType = 76;
	public static readonly RULE_compareOp = 77;
	public static readonly RULE_literal = 78;
	public static readonly RULE_dateLiteral = 79;
	public static readonly RULE_tableName = 80;
	public static readonly RULE_id = 81;
	public static readonly RULE_timeframe = 82;
	public static readonly RULE_ungroup = 83;
	public static readonly RULE_fieldExpr = 84;
	public static readonly RULE_partialAllowedFieldExpr = 85;
	public static readonly RULE_pickStatement = 86;
	public static readonly RULE_pick = 87;
	public static readonly RULE_argumentList = 88;
	public static readonly RULE_fieldNameList = 89;
	public static readonly RULE_fieldCollection = 90;
	public static readonly RULE_collectionMember = 91;
	public static readonly RULE_fieldPath = 92;
	public static readonly RULE_joinName = 93;
	public static readonly RULE_fieldName = 94;
	public static readonly RULE_justExpr = 95;
	public static readonly RULE_json = 96;
	public static readonly RULE_jsonValue = 97;
	public static readonly RULE_jsonObject = 98;
	public static readonly RULE_jsonProperty = 99;
	public static readonly RULE_jsonArray = 100;
	public static readonly RULE_sqlExploreNameRef = 101;
	public static readonly RULE_nameSQLBlock = 102;
	public static readonly RULE_connectionName = 103;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"malloyDocument", "malloyStatement", "defineExploreStatement", "exploreKeyword", 
		"defineQuery", "topLevelAnonQueryDef", "defineSQLStatement", "sqlBlock", 
		"blockSQLDef", "sqlString", "sqlInterpolation", "importStatement", "importURL", 
		"topLevelQueryDefs", "topLevelQueryDef", "refineOperator", "query", "pipelineFromName", 
		"firstSegment", "pipeElement", "exploreTable", "queryProperties", "filterShortcut", 
		"exploreQueryName", "queryName", "exploreDefinitionList", "exploreDefinition", 
		"explore", "exploreSource", "exploreNameDef", "exploreName", "exploreProperties", 
		"exploreStatement", "renameList", "exploreRenameDef", "dimensionDefList", 
		"measureDefList", "fieldDef", "fieldNameDef", "joinNameDef", "measureDef", 
		"declareStatement", "joinStatement", "joinList", "joinDef", "joinExpression", 
		"filterStatement", "filteredBy", "filterClauseList", "whereStatement", 
		"havingStatement", "subQueryDefList", "exploreQueryNameDef", "exploreQueryDef", 
		"queryStatement", "groupByStatement", "queryFieldList", "dimensionDef", 
		"queryFieldEntry", "nestStatement", "nestedQueryList", "nestEntry", "aggregateStatement", 
		"projectStatement", "orderByStatement", "ordering", "orderBySpec", "limitStatement", 
		"bySpec", "topStatement", "indexElement", "indexFields", "indexStatement", 
		"sampleStatement", "sampleSpec", "aggregate", "malloyType", "compareOp", 
		"literal", "dateLiteral", "tableName", "id", "timeframe", "ungroup", "fieldExpr", 
		"partialAllowedFieldExpr", "pickStatement", "pick", "argumentList", "fieldNameList", 
		"fieldCollection", "collectionMember", "fieldPath", "joinName", "fieldName", 
		"justExpr", "json", "jsonValue", "jsonObject", "jsonProperty", "jsonArray", 
		"sqlExploreNameRef", "nameSQLBlock", "connectionName",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, "'?'", 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, "'&'", "'->'", 
		"'=>'", "'('", "')'", "'['", "']'", "'{'", "'}'", "'::'", "':'", "','", 
		"'.'", "'<'", "'>'", "'='", "'!='", "'<='", "'>='", "'+'", "'-'", "'*'", 
		"'**'", "'/'", "'|'", "';'", "'!~'", "'~'", "'%'", undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, undefined, undefined, 
		undefined, undefined, undefined, undefined, undefined, "'\"\"\"'", "'}%'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, "JSON_STRING", "ACCEPT", "AGGREGATE", "CONNECTION", "DECLARE", 
		"DIMENSION", "EXCEPT", "EXPLORE", "GROUP_BY", "HAVING", "INDEX", "JOIN_CROSS", 
		"JOIN_ONE", "JOIN_MANY", "LIMIT", "MEASURE", "NEST", "ORDER_BY", "PRIMARY_KEY", 
		"PROJECT", "QUERY", "RENAME", "SAMPLE", "SELECT", "SOURCE", "SQL", "FANCYSQL", 
		"TOP", "WHERE", "ALL", "AND", "AS", "ASC", "AVG", "BOOLEAN", "BY", "CASE", 
		"CAST", "CONDITION", "COUNT", "DATE", "DAY", "DESC", "DISTINCT", "ELSE", 
		"END", "EXCLUDE", "FALSE", "FOR", "FROM", "FROM_SQL", "HAS", "HOUR", "IMPORT", 
		"IS", "JSON", "LAST", "MAX", "MIN", "MINUTE", "MONTH", "NOT", "NOW", "NULL", 
		"NUMBER", "ON", "OR", "PICK", "QMARK", "QUARTER", "SECOND", "STRING", 
		"SUM", "TABLE", "THEN", "THIS", "TIMESTAMP", "TO", "TRUE", "TURTLE", "WEEK", 
		"WHEN", "WITH", "YEAR", "UNGROUPED", "STRING_ESCAPE", "HACKY_REGEX", "STRING_LITERAL", 
		"AMPER", "ARROW", "FAT_ARROW", "OPAREN", "CPAREN", "OBRACK", "CBRACK", 
		"OCURLY", "CCURLY", "DOUBLECOLON", "COLON", "COMMA", "DOT", "LT", "GT", 
		"EQ", "NE", "LTE", "GTE", "PLUS", "MINUS", "STAR", "STARSTAR", "SLASH", 
		"BAR", "SEMI", "NOT_MATCH", "MATCH", "PERCENT", "LITERAL_TIMESTAMP", "LITERAL_DAY", 
		"LITERAL_QUARTER", "LITERAL_MONTH", "LITERAL_WEEK", "LITERAL_YEAR", "IDENTIFIER", 
		"PERCENT_LITERAL", "INTEGER_LITERAL", "NUMERIC_LITERAL", "OBJECT_NAME_LITERAL", 
		"BLOCK_COMMENT", "COMMENT_TO_EOL", "WHITE_SPACE", "SQL_BEGIN", "CLOSE_CODE", 
		"UNWATED_CHARS_TRAILING_NUMBERS", "UNEXPECTED_CHAR", "OPEN_CODE", "SQL_END",
	];
	public static readonly VOCABULARY: Vocabulary = new VocabularyImpl(MalloyParser._LITERAL_NAMES, MalloyParser._SYMBOLIC_NAMES, []);

	// @Override
	// @NotNull
	public get vocabulary(): Vocabulary {
		return MalloyParser.VOCABULARY;
	}
	// tslint:enable:no-trailing-whitespace

	// @Override
	public get grammarFileName(): string { return "MalloyParser.g4"; }

	// @Override
	public get ruleNames(): string[] { return MalloyParser.ruleNames; }

	// @Override
	public get serializedATN(): string { return MalloyParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(MalloyParser._ATN, this);
	}
	// @RuleVersion(0)
	public malloyDocument(): MalloyDocumentContext {
		let _localctx: MalloyDocumentContext = new MalloyDocumentContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, MalloyParser.RULE_malloyDocument);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 212;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << MalloyParser.EXPLORE) | (1 << MalloyParser.QUERY) | (1 << MalloyParser.SOURCE) | (1 << MalloyParser.SQL))) !== 0) || _la === MalloyParser.IMPORT || _la === MalloyParser.SEMI) {
				{
				this.state = 210;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case MalloyParser.EXPLORE:
				case MalloyParser.QUERY:
				case MalloyParser.SOURCE:
				case MalloyParser.SQL:
				case MalloyParser.IMPORT:
					{
					this.state = 208;
					this.malloyStatement();
					}
					break;
				case MalloyParser.SEMI:
					{
					this.state = 209;
					this.match(MalloyParser.SEMI);
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 214;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 215;
			this.match(MalloyParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public malloyStatement(): MalloyStatementContext {
		let _localctx: MalloyStatementContext = new MalloyStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, MalloyParser.RULE_malloyStatement);
		try {
			this.state = 221;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.EXPLORE:
			case MalloyParser.SOURCE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 217;
				this.defineExploreStatement();
				}
				break;
			case MalloyParser.SQL:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 218;
				this.defineSQLStatement();
				}
				break;
			case MalloyParser.QUERY:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 219;
				this.defineQuery();
				}
				break;
			case MalloyParser.IMPORT:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 220;
				this.importStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public defineExploreStatement(): DefineExploreStatementContext {
		let _localctx: DefineExploreStatementContext = new DefineExploreStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, MalloyParser.RULE_defineExploreStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 223;
			this.exploreKeyword();
			this.state = 224;
			this.exploreDefinitionList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreKeyword(): ExploreKeywordContext {
		let _localctx: ExploreKeywordContext = new ExploreKeywordContext(this._ctx, this.state);
		this.enterRule(_localctx, 6, MalloyParser.RULE_exploreKeyword);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 226;
			_la = this._input.LA(1);
			if (!(_la === MalloyParser.EXPLORE || _la === MalloyParser.SOURCE)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public defineQuery(): DefineQueryContext {
		let _localctx: DefineQueryContext = new DefineQueryContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, MalloyParser.RULE_defineQuery);
		try {
			this.state = 232;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 3, this._ctx) ) {
			case 1:
				_localctx = new NamedQueries_stubContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 228;
				this.match(MalloyParser.QUERY);
				this.state = 229;
				this.topLevelQueryDefs();
				}
				break;

			case 2:
				_localctx = new AnonymousQueryContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 230;
				this.match(MalloyParser.QUERY);
				this.state = 231;
				this.topLevelAnonQueryDef();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public topLevelAnonQueryDef(): TopLevelAnonQueryDefContext {
		let _localctx: TopLevelAnonQueryDefContext = new TopLevelAnonQueryDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, MalloyParser.RULE_topLevelAnonQueryDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 234;
			this.query();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public defineSQLStatement(): DefineSQLStatementContext {
		let _localctx: DefineSQLStatementContext = new DefineSQLStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 12, MalloyParser.RULE_defineSQLStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 236;
			this.match(MalloyParser.SQL);
			this.state = 240;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.IDENTIFIER || _la === MalloyParser.OBJECT_NAME_LITERAL) {
				{
				this.state = 237;
				this.nameSQLBlock();
				this.state = 238;
				this.match(MalloyParser.IS);
				}
			}

			this.state = 242;
			this.sqlBlock();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sqlBlock(): SqlBlockContext {
		let _localctx: SqlBlockContext = new SqlBlockContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, MalloyParser.RULE_sqlBlock);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 244;
			this.match(MalloyParser.OCURLY);
			this.state = 246;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 245;
				this.blockSQLDef();
				}
				}
				this.state = 248;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la === MalloyParser.CONNECTION || _la === MalloyParser.SELECT);
			this.state = 250;
			this.match(MalloyParser.CCURLY);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public blockSQLDef(): BlockSQLDefContext {
		let _localctx: BlockSQLDefContext = new BlockSQLDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, MalloyParser.RULE_blockSQLDef);
		try {
			this.state = 256;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.CONNECTION:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 252;
				this.match(MalloyParser.CONNECTION);
				this.state = 253;
				this.connectionName();
				}
				break;
			case MalloyParser.SELECT:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 254;
				this.match(MalloyParser.SELECT);
				this.state = 255;
				this.sqlString();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sqlString(): SqlStringContext {
		let _localctx: SqlStringContext = new SqlStringContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, MalloyParser.RULE_sqlString);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 258;
			this.match(MalloyParser.SQL_BEGIN);
			this.state = 262;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === MalloyParser.OPEN_CODE) {
				{
				{
				this.state = 259;
				this.sqlInterpolation();
				}
				}
				this.state = 264;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 265;
			this.match(MalloyParser.SQL_END);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sqlInterpolation(): SqlInterpolationContext {
		let _localctx: SqlInterpolationContext = new SqlInterpolationContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, MalloyParser.RULE_sqlInterpolation);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 267;
			this.match(MalloyParser.OPEN_CODE);
			this.state = 268;
			this.query();
			this.state = 269;
			this.match(MalloyParser.CLOSE_CODE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public importStatement(): ImportStatementContext {
		let _localctx: ImportStatementContext = new ImportStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, MalloyParser.RULE_importStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 271;
			this.match(MalloyParser.IMPORT);
			this.state = 272;
			this.importURL();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public importURL(): ImportURLContext {
		let _localctx: ImportURLContext = new ImportURLContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, MalloyParser.RULE_importURL);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 274;
			this.match(MalloyParser.JSON_STRING);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public topLevelQueryDefs(): TopLevelQueryDefsContext {
		let _localctx: TopLevelQueryDefsContext = new TopLevelQueryDefsContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, MalloyParser.RULE_topLevelQueryDefs);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 276;
			this.topLevelQueryDef();
			this.state = 283;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 9, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 278;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 277;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 280;
					this.topLevelQueryDef();
					}
					}
				}
				this.state = 285;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 9, this._ctx);
			}
			this.state = 287;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 286;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public topLevelQueryDef(): TopLevelQueryDefContext {
		let _localctx: TopLevelQueryDefContext = new TopLevelQueryDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, MalloyParser.RULE_topLevelQueryDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 289;
			this.queryName();
			this.state = 290;
			this.match(MalloyParser.IS);
			this.state = 291;
			this.query();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public refineOperator(): RefineOperatorContext {
		let _localctx: RefineOperatorContext = new RefineOperatorContext(this._ctx, this.state);
		this.enterRule(_localctx, 30, MalloyParser.RULE_refineOperator);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 293;
			this.match(MalloyParser.PLUS);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public query(): QueryContext {
		let _localctx: QueryContext = new QueryContext(this._ctx, this.state);
		this.enterRule(_localctx, 32, MalloyParser.RULE_query);
		let _la: number;
		try {
			this.state = 313;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.FROM:
			case MalloyParser.FROM_SQL:
			case MalloyParser.TABLE:
			case MalloyParser.IDENTIFIER:
			case MalloyParser.OBJECT_NAME_LITERAL:
				_localctx = new ExploreArrowQueryContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 295;
				this.explore();
				this.state = 296;
				this.match(MalloyParser.ARROW);
				this.state = 297;
				this.pipelineFromName();
				}
				break;
			case MalloyParser.ARROW:
				_localctx = new ArrowQueryContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 299;
				this.match(MalloyParser.ARROW);
				this.state = 300;
				this.queryName();
				this.state = 305;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.OCURLY || _la === MalloyParser.PLUS) {
					{
					this.state = 302;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.PLUS) {
						{
						this.state = 301;
						this.refineOperator();
						}
					}

					this.state = 304;
					this.queryProperties();
					}
				}

				this.state = 310;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === MalloyParser.ARROW) {
					{
					{
					this.state = 307;
					this.pipeElement();
					}
					}
					this.state = 312;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public pipelineFromName(): PipelineFromNameContext {
		let _localctx: PipelineFromNameContext = new PipelineFromNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 34, MalloyParser.RULE_pipelineFromName);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 315;
			this.firstSegment();
			this.state = 319;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === MalloyParser.ARROW) {
				{
				{
				this.state = 316;
				this.pipeElement();
				}
				}
				this.state = 321;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public firstSegment(): FirstSegmentContext {
		let _localctx: FirstSegmentContext = new FirstSegmentContext(this._ctx, this.state);
		this.enterRule(_localctx, 36, MalloyParser.RULE_firstSegment);
		let _la: number;
		try {
			this.state = 330;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.OCURLY:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 322;
				this.queryProperties();
				}
				break;
			case MalloyParser.IDENTIFIER:
			case MalloyParser.OBJECT_NAME_LITERAL:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 323;
				this.exploreQueryName();
				this.state = 328;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.OCURLY || _la === MalloyParser.PLUS) {
					{
					this.state = 325;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.PLUS) {
						{
						this.state = 324;
						this.refineOperator();
						}
					}

					this.state = 327;
					this.queryProperties();
					}
				}

				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public pipeElement(): PipeElementContext {
		let _localctx: PipeElementContext = new PipeElementContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, MalloyParser.RULE_pipeElement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 332;
			this.match(MalloyParser.ARROW);
			this.state = 333;
			this.queryProperties();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreTable(): ExploreTableContext {
		let _localctx: ExploreTableContext = new ExploreTableContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, MalloyParser.RULE_exploreTable);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 335;
			this.match(MalloyParser.TABLE);
			this.state = 336;
			this.match(MalloyParser.OPAREN);
			this.state = 337;
			this.tableName();
			this.state = 338;
			this.match(MalloyParser.CPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public queryProperties(): QueryPropertiesContext {
		let _localctx: QueryPropertiesContext = new QueryPropertiesContext(this._ctx, this.state);
		this.enterRule(_localctx, 42, MalloyParser.RULE_queryProperties);
		let _la: number;
		try {
			this.state = 350;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 21, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 340;
				this.filterShortcut();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 341;
				this.match(MalloyParser.OCURLY);
				this.state = 346;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << MalloyParser.AGGREGATE) | (1 << MalloyParser.DECLARE) | (1 << MalloyParser.GROUP_BY) | (1 << MalloyParser.HAVING) | (1 << MalloyParser.INDEX) | (1 << MalloyParser.JOIN_CROSS) | (1 << MalloyParser.JOIN_ONE) | (1 << MalloyParser.JOIN_MANY) | (1 << MalloyParser.LIMIT) | (1 << MalloyParser.NEST) | (1 << MalloyParser.ORDER_BY) | (1 << MalloyParser.PROJECT) | (1 << MalloyParser.SAMPLE) | (1 << MalloyParser.TOP) | (1 << MalloyParser.WHERE))) !== 0) || _la === MalloyParser.SEMI) {
					{
					this.state = 344;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case MalloyParser.AGGREGATE:
					case MalloyParser.DECLARE:
					case MalloyParser.GROUP_BY:
					case MalloyParser.HAVING:
					case MalloyParser.INDEX:
					case MalloyParser.JOIN_CROSS:
					case MalloyParser.JOIN_ONE:
					case MalloyParser.JOIN_MANY:
					case MalloyParser.LIMIT:
					case MalloyParser.NEST:
					case MalloyParser.ORDER_BY:
					case MalloyParser.PROJECT:
					case MalloyParser.SAMPLE:
					case MalloyParser.TOP:
					case MalloyParser.WHERE:
						{
						this.state = 342;
						this.queryStatement();
						}
						break;
					case MalloyParser.SEMI:
						{
						this.state = 343;
						this.match(MalloyParser.SEMI);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 348;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 349;
				this.match(MalloyParser.CCURLY);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public filterShortcut(): FilterShortcutContext {
		let _localctx: FilterShortcutContext = new FilterShortcutContext(this._ctx, this.state);
		this.enterRule(_localctx, 44, MalloyParser.RULE_filterShortcut);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 352;
			this.match(MalloyParser.OCURLY);
			this.state = 353;
			this.match(MalloyParser.QMARK);
			this.state = 354;
			this.fieldExpr(0);
			this.state = 355;
			this.match(MalloyParser.CCURLY);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreQueryName(): ExploreQueryNameContext {
		let _localctx: ExploreQueryNameContext = new ExploreQueryNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 46, MalloyParser.RULE_exploreQueryName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 357;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public queryName(): QueryNameContext {
		let _localctx: QueryNameContext = new QueryNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 48, MalloyParser.RULE_queryName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 359;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreDefinitionList(): ExploreDefinitionListContext {
		let _localctx: ExploreDefinitionListContext = new ExploreDefinitionListContext(this._ctx, this.state);
		this.enterRule(_localctx, 50, MalloyParser.RULE_exploreDefinitionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 361;
			this.exploreDefinition();
			this.state = 368;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 363;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 362;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 365;
					this.exploreDefinition();
					}
					}
				}
				this.state = 370;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
			}
			this.state = 372;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 371;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreDefinition(): ExploreDefinitionContext {
		let _localctx: ExploreDefinitionContext = new ExploreDefinitionContext(this._ctx, this.state);
		this.enterRule(_localctx, 52, MalloyParser.RULE_exploreDefinition);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 374;
			this.exploreNameDef();
			this.state = 375;
			this.match(MalloyParser.IS);
			this.state = 376;
			this.explore();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public explore(): ExploreContext {
		let _localctx: ExploreContext = new ExploreContext(this._ctx, this.state);
		this.enterRule(_localctx, 54, MalloyParser.RULE_explore);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 378;
			this.exploreSource();
			this.state = 383;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.OCURLY || _la === MalloyParser.PLUS) {
				{
				this.state = 380;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.PLUS) {
					{
					this.state = 379;
					this.refineOperator();
					}
				}

				this.state = 382;
				this.exploreProperties();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreSource(): ExploreSourceContext {
		let _localctx: ExploreSourceContext = new ExploreSourceContext(this._ctx, this.state);
		this.enterRule(_localctx, 56, MalloyParser.RULE_exploreSource);
		try {
			this.state = 397;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.IDENTIFIER:
			case MalloyParser.OBJECT_NAME_LITERAL:
				_localctx = new NamedSourceContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 385;
				this.exploreName();
				}
				break;
			case MalloyParser.TABLE:
				_localctx = new TableSourceContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 386;
				this.exploreTable();
				}
				break;
			case MalloyParser.FROM:
				_localctx = new QuerySourceContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 387;
				this.match(MalloyParser.FROM);
				this.state = 388;
				this.match(MalloyParser.OPAREN);
				this.state = 389;
				this.query();
				this.state = 390;
				this.match(MalloyParser.CPAREN);
				}
				break;
			case MalloyParser.FROM_SQL:
				_localctx = new SQLSourceNameContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 392;
				this.match(MalloyParser.FROM_SQL);
				this.state = 393;
				this.match(MalloyParser.OPAREN);
				this.state = 394;
				this.sqlExploreNameRef();
				this.state = 395;
				this.match(MalloyParser.CPAREN);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreNameDef(): ExploreNameDefContext {
		let _localctx: ExploreNameDefContext = new ExploreNameDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 58, MalloyParser.RULE_exploreNameDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 399;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreName(): ExploreNameContext {
		let _localctx: ExploreNameContext = new ExploreNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 60, MalloyParser.RULE_exploreName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 401;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreProperties(): ExplorePropertiesContext {
		let _localctx: ExplorePropertiesContext = new ExplorePropertiesContext(this._ctx, this.state);
		this.enterRule(_localctx, 62, MalloyParser.RULE_exploreProperties);
		let _la: number;
		try {
			this.state = 413;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 30, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 403;
				this.match(MalloyParser.OCURLY);
				this.state = 408;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << MalloyParser.ACCEPT) | (1 << MalloyParser.DECLARE) | (1 << MalloyParser.DIMENSION) | (1 << MalloyParser.EXCEPT) | (1 << MalloyParser.JOIN_CROSS) | (1 << MalloyParser.JOIN_ONE) | (1 << MalloyParser.JOIN_MANY) | (1 << MalloyParser.MEASURE) | (1 << MalloyParser.PRIMARY_KEY) | (1 << MalloyParser.QUERY) | (1 << MalloyParser.RENAME) | (1 << MalloyParser.WHERE))) !== 0) || _la === MalloyParser.SEMI) {
					{
					this.state = 406;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case MalloyParser.ACCEPT:
					case MalloyParser.DECLARE:
					case MalloyParser.DIMENSION:
					case MalloyParser.EXCEPT:
					case MalloyParser.JOIN_CROSS:
					case MalloyParser.JOIN_ONE:
					case MalloyParser.JOIN_MANY:
					case MalloyParser.MEASURE:
					case MalloyParser.PRIMARY_KEY:
					case MalloyParser.QUERY:
					case MalloyParser.RENAME:
					case MalloyParser.WHERE:
						{
						this.state = 404;
						this.exploreStatement();
						}
						break;
					case MalloyParser.SEMI:
						{
						this.state = 405;
						this.match(MalloyParser.SEMI);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 410;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 411;
				this.match(MalloyParser.CCURLY);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 412;
				this.filterShortcut();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreStatement(): ExploreStatementContext {
		let _localctx: ExploreStatementContext = new ExploreStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 64, MalloyParser.RULE_exploreStatement);
		let _la: number;
		try {
			this.state = 430;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.DIMENSION:
				_localctx = new DefExploreDimensionContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 415;
				this.match(MalloyParser.DIMENSION);
				this.state = 416;
				this.dimensionDefList();
				}
				break;
			case MalloyParser.MEASURE:
				_localctx = new DefExploreMeasureContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 417;
				this.match(MalloyParser.MEASURE);
				this.state = 418;
				this.measureDefList();
				}
				break;
			case MalloyParser.DECLARE:
				_localctx = new DefDeclare_stubContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 419;
				this.declareStatement();
				}
				break;
			case MalloyParser.JOIN_CROSS:
			case MalloyParser.JOIN_ONE:
			case MalloyParser.JOIN_MANY:
				_localctx = new DefJoin_stubContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 420;
				this.joinStatement();
				}
				break;
			case MalloyParser.WHERE:
				_localctx = new DefExploreWhereContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 421;
				this.whereStatement();
				}
				break;
			case MalloyParser.PRIMARY_KEY:
				_localctx = new DefExplorePrimaryKeyContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 422;
				this.match(MalloyParser.PRIMARY_KEY);
				this.state = 423;
				this.fieldName();
				}
				break;
			case MalloyParser.RENAME:
				_localctx = new DefExploreRenameContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 424;
				this.match(MalloyParser.RENAME);
				this.state = 425;
				this.renameList();
				}
				break;
			case MalloyParser.ACCEPT:
			case MalloyParser.EXCEPT:
				_localctx = new DefExploreEditFieldContext(_localctx);
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 426;
				_la = this._input.LA(1);
				if (!(_la === MalloyParser.ACCEPT || _la === MalloyParser.EXCEPT)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				this.state = 427;
				this.fieldNameList();
				}
				break;
			case MalloyParser.QUERY:
				_localctx = new DefExploreQueryContext(_localctx);
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 428;
				this.match(MalloyParser.QUERY);
				this.state = 429;
				this.subQueryDefList();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public renameList(): RenameListContext {
		let _localctx: RenameListContext = new RenameListContext(this._ctx, this.state);
		this.enterRule(_localctx, 66, MalloyParser.RULE_renameList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 432;
			this.exploreRenameDef();
			this.state = 439;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 33, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 434;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 433;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 436;
					this.exploreRenameDef();
					}
					}
				}
				this.state = 441;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 33, this._ctx);
			}
			this.state = 443;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 442;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreRenameDef(): ExploreRenameDefContext {
		let _localctx: ExploreRenameDefContext = new ExploreRenameDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 68, MalloyParser.RULE_exploreRenameDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 445;
			this.fieldName();
			this.state = 446;
			this.match(MalloyParser.IS);
			this.state = 447;
			this.fieldName();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dimensionDefList(): DimensionDefListContext {
		let _localctx: DimensionDefListContext = new DimensionDefListContext(this._ctx, this.state);
		this.enterRule(_localctx, 70, MalloyParser.RULE_dimensionDefList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 449;
			this.dimensionDef();
			this.state = 456;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 36, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 451;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 450;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 453;
					this.dimensionDef();
					}
					}
				}
				this.state = 458;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 36, this._ctx);
			}
			this.state = 460;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 459;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public measureDefList(): MeasureDefListContext {
		let _localctx: MeasureDefListContext = new MeasureDefListContext(this._ctx, this.state);
		this.enterRule(_localctx, 72, MalloyParser.RULE_measureDefList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 462;
			this.measureDef();
			this.state = 469;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 39, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 464;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 463;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 466;
					this.measureDef();
					}
					}
				}
				this.state = 471;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 39, this._ctx);
			}
			this.state = 473;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 472;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldDef(): FieldDefContext {
		let _localctx: FieldDefContext = new FieldDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 74, MalloyParser.RULE_fieldDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 475;
			this.fieldNameDef();
			this.state = 476;
			this.match(MalloyParser.IS);
			this.state = 477;
			this.fieldExpr(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldNameDef(): FieldNameDefContext {
		let _localctx: FieldNameDefContext = new FieldNameDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 76, MalloyParser.RULE_fieldNameDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 479;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinNameDef(): JoinNameDefContext {
		let _localctx: JoinNameDefContext = new JoinNameDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 78, MalloyParser.RULE_joinNameDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 481;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public measureDef(): MeasureDefContext {
		let _localctx: MeasureDefContext = new MeasureDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 80, MalloyParser.RULE_measureDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 483;
			this.fieldDef();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public declareStatement(): DeclareStatementContext {
		let _localctx: DeclareStatementContext = new DeclareStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 82, MalloyParser.RULE_declareStatement);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 485;
			this.match(MalloyParser.DECLARE);
			this.state = 486;
			this.fieldDef();
			this.state = 493;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 42, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 488;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 487;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 490;
					this.fieldDef();
					}
					}
				}
				this.state = 495;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 42, this._ctx);
			}
			this.state = 497;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 496;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinStatement(): JoinStatementContext {
		let _localctx: JoinStatementContext = new JoinStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 84, MalloyParser.RULE_joinStatement);
		try {
			this.state = 505;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.JOIN_ONE:
				_localctx = new DefJoinOneContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 499;
				this.match(MalloyParser.JOIN_ONE);
				this.state = 500;
				this.joinList();
				}
				break;
			case MalloyParser.JOIN_MANY:
				_localctx = new DefJoinManyContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 501;
				this.match(MalloyParser.JOIN_MANY);
				this.state = 502;
				this.joinList();
				}
				break;
			case MalloyParser.JOIN_CROSS:
				_localctx = new DefJoinCrossContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 503;
				this.match(MalloyParser.JOIN_CROSS);
				this.state = 504;
				this.joinList();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinList(): JoinListContext {
		let _localctx: JoinListContext = new JoinListContext(this._ctx, this.state);
		this.enterRule(_localctx, 86, MalloyParser.RULE_joinList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 507;
			this.joinDef();
			this.state = 514;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 46, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 509;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 508;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 511;
					this.joinDef();
					}
					}
				}
				this.state = 516;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 46, this._ctx);
			}
			this.state = 518;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 517;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinDef(): JoinDefContext {
		let _localctx: JoinDefContext = new JoinDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 88, MalloyParser.RULE_joinDef);
		let _la: number;
		try {
			this.state = 537;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 51, this._ctx) ) {
			case 1:
				_localctx = new JoinWithContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 520;
				this.joinNameDef();
				this.state = 523;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.IS) {
					{
					this.state = 521;
					this.match(MalloyParser.IS);
					this.state = 522;
					this.explore();
					}
				}

				this.state = 525;
				this.match(MalloyParser.WITH);
				this.state = 526;
				this.fieldExpr(0);
				}
				break;

			case 2:
				_localctx = new JoinOnContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 528;
				this.joinNameDef();
				this.state = 531;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.IS) {
					{
					this.state = 529;
					this.match(MalloyParser.IS);
					this.state = 530;
					this.explore();
					}
				}

				this.state = 535;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.ON) {
					{
					this.state = 533;
					this.match(MalloyParser.ON);
					this.state = 534;
					this.joinExpression();
					}
				}

				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinExpression(): JoinExpressionContext {
		let _localctx: JoinExpressionContext = new JoinExpressionContext(this._ctx, this.state);
		this.enterRule(_localctx, 90, MalloyParser.RULE_joinExpression);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 539;
			this.fieldExpr(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public filterStatement(): FilterStatementContext {
		let _localctx: FilterStatementContext = new FilterStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 92, MalloyParser.RULE_filterStatement);
		try {
			this.state = 543;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.WHERE:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 541;
				this.whereStatement();
				}
				break;
			case MalloyParser.HAVING:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 542;
				this.havingStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public filteredBy(): FilteredByContext {
		let _localctx: FilteredByContext = new FilteredByContext(this._ctx, this.state);
		this.enterRule(_localctx, 94, MalloyParser.RULE_filteredBy);
		try {
			this.state = 548;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.QMARK:
				_localctx = new FilterByShortcutContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 545;
				this.match(MalloyParser.QMARK);
				this.state = 546;
				this.fieldExpr(0);
				}
				break;
			case MalloyParser.WHERE:
				_localctx = new FilterByWhereContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 547;
				this.whereStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public filterClauseList(): FilterClauseListContext {
		let _localctx: FilterClauseListContext = new FilterClauseListContext(this._ctx, this.state);
		this.enterRule(_localctx, 96, MalloyParser.RULE_filterClauseList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 550;
			this.fieldExpr(0);
			this.state = 555;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 54, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 551;
					this.match(MalloyParser.COMMA);
					this.state = 552;
					this.fieldExpr(0);
					}
					}
				}
				this.state = 557;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 54, this._ctx);
			}
			this.state = 559;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 558;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public whereStatement(): WhereStatementContext {
		let _localctx: WhereStatementContext = new WhereStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 98, MalloyParser.RULE_whereStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 561;
			this.match(MalloyParser.WHERE);
			this.state = 562;
			this.filterClauseList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public havingStatement(): HavingStatementContext {
		let _localctx: HavingStatementContext = new HavingStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 100, MalloyParser.RULE_havingStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 564;
			this.match(MalloyParser.HAVING);
			this.state = 565;
			this.filterClauseList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public subQueryDefList(): SubQueryDefListContext {
		let _localctx: SubQueryDefListContext = new SubQueryDefListContext(this._ctx, this.state);
		this.enterRule(_localctx, 102, MalloyParser.RULE_subQueryDefList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 567;
			this.exploreQueryDef();
			this.state = 574;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 57, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 569;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 568;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 571;
					this.exploreQueryDef();
					}
					}
				}
				this.state = 576;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 57, this._ctx);
			}
			this.state = 578;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 577;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreQueryNameDef(): ExploreQueryNameDefContext {
		let _localctx: ExploreQueryNameDefContext = new ExploreQueryNameDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 104, MalloyParser.RULE_exploreQueryNameDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 580;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public exploreQueryDef(): ExploreQueryDefContext {
		let _localctx: ExploreQueryDefContext = new ExploreQueryDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 106, MalloyParser.RULE_exploreQueryDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 582;
			this.exploreQueryNameDef();
			this.state = 583;
			this.match(MalloyParser.IS);
			this.state = 584;
			this.pipelineFromName();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public queryStatement(): QueryStatementContext {
		let _localctx: QueryStatementContext = new QueryStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 108, MalloyParser.RULE_queryStatement);
		try {
			this.state = 599;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.GROUP_BY:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 586;
				this.groupByStatement();
				}
				break;
			case MalloyParser.DECLARE:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 587;
				this.declareStatement();
				}
				break;
			case MalloyParser.JOIN_CROSS:
			case MalloyParser.JOIN_ONE:
			case MalloyParser.JOIN_MANY:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 588;
				this.joinStatement();
				}
				break;
			case MalloyParser.PROJECT:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 589;
				this.projectStatement();
				}
				break;
			case MalloyParser.INDEX:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 590;
				this.indexStatement();
				}
				break;
			case MalloyParser.AGGREGATE:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 591;
				this.aggregateStatement();
				}
				break;
			case MalloyParser.TOP:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 592;
				this.topStatement();
				}
				break;
			case MalloyParser.LIMIT:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 593;
				this.limitStatement();
				}
				break;
			case MalloyParser.ORDER_BY:
				this.enterOuterAlt(_localctx, 9);
				{
				this.state = 594;
				this.orderByStatement();
				}
				break;
			case MalloyParser.WHERE:
				this.enterOuterAlt(_localctx, 10);
				{
				this.state = 595;
				this.whereStatement();
				}
				break;
			case MalloyParser.HAVING:
				this.enterOuterAlt(_localctx, 11);
				{
				this.state = 596;
				this.havingStatement();
				}
				break;
			case MalloyParser.NEST:
				this.enterOuterAlt(_localctx, 12);
				{
				this.state = 597;
				this.nestStatement();
				}
				break;
			case MalloyParser.SAMPLE:
				this.enterOuterAlt(_localctx, 13);
				{
				this.state = 598;
				this.sampleStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public groupByStatement(): GroupByStatementContext {
		let _localctx: GroupByStatementContext = new GroupByStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 110, MalloyParser.RULE_groupByStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 601;
			this.match(MalloyParser.GROUP_BY);
			this.state = 602;
			this.queryFieldList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public queryFieldList(): QueryFieldListContext {
		let _localctx: QueryFieldListContext = new QueryFieldListContext(this._ctx, this.state);
		this.enterRule(_localctx, 112, MalloyParser.RULE_queryFieldList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 604;
			this.queryFieldEntry();
			this.state = 611;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 61, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 606;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 605;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 608;
					this.queryFieldEntry();
					}
					}
				}
				this.state = 613;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 61, this._ctx);
			}
			this.state = 615;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 614;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dimensionDef(): DimensionDefContext {
		let _localctx: DimensionDefContext = new DimensionDefContext(this._ctx, this.state);
		this.enterRule(_localctx, 114, MalloyParser.RULE_dimensionDef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 617;
			this.fieldDef();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public queryFieldEntry(): QueryFieldEntryContext {
		let _localctx: QueryFieldEntryContext = new QueryFieldEntryContext(this._ctx, this.state);
		this.enterRule(_localctx, 116, MalloyParser.RULE_queryFieldEntry);
		try {
			this.state = 621;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				_localctx = new QueryFieldRefContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 619;
				this.fieldPath();
				}
				break;

			case 2:
				_localctx = new QueryFieldDefContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 620;
				this.dimensionDef();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public nestStatement(): NestStatementContext {
		let _localctx: NestStatementContext = new NestStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 118, MalloyParser.RULE_nestStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 623;
			this.match(MalloyParser.NEST);
			this.state = 624;
			this.nestedQueryList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public nestedQueryList(): NestedQueryListContext {
		let _localctx: NestedQueryListContext = new NestedQueryListContext(this._ctx, this.state);
		this.enterRule(_localctx, 120, MalloyParser.RULE_nestedQueryList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 626;
			this.nestEntry();
			this.state = 633;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 65, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 628;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 627;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 630;
					this.nestEntry();
					}
					}
				}
				this.state = 635;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 65, this._ctx);
			}
			this.state = 637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 636;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public nestEntry(): NestEntryContext {
		let _localctx: NestEntryContext = new NestEntryContext(this._ctx, this.state);
		this.enterRule(_localctx, 122, MalloyParser.RULE_nestEntry);
		let _la: number;
		try {
			this.state = 650;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 69, this._ctx) ) {
			case 1:
				_localctx = new NestExistingContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 639;
				this.queryName();
				this.state = 644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.OCURLY || _la === MalloyParser.PLUS) {
					{
					this.state = 641;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.PLUS) {
						{
						this.state = 640;
						this.refineOperator();
						}
					}

					this.state = 643;
					this.queryProperties();
					}
				}

				}
				break;

			case 2:
				_localctx = new NestDefContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 646;
				this.queryName();
				this.state = 647;
				this.match(MalloyParser.IS);
				this.state = 648;
				this.pipelineFromName();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public aggregateStatement(): AggregateStatementContext {
		let _localctx: AggregateStatementContext = new AggregateStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 124, MalloyParser.RULE_aggregateStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 652;
			this.match(MalloyParser.AGGREGATE);
			this.state = 653;
			this.queryFieldList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public projectStatement(): ProjectStatementContext {
		let _localctx: ProjectStatementContext = new ProjectStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 126, MalloyParser.RULE_projectStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 655;
			this.match(MalloyParser.PROJECT);
			this.state = 656;
			this.fieldCollection();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public orderByStatement(): OrderByStatementContext {
		let _localctx: OrderByStatementContext = new OrderByStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 128, MalloyParser.RULE_orderByStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 658;
			this.match(MalloyParser.ORDER_BY);
			this.state = 659;
			this.ordering();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public ordering(): OrderingContext {
		let _localctx: OrderingContext = new OrderingContext(this._ctx, this.state);
		this.enterRule(_localctx, 130, MalloyParser.RULE_ordering);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 661;
			this.orderBySpec();
			this.state = 668;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 71, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 663;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 662;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 665;
					this.orderBySpec();
					}
					}
				}
				this.state = 670;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 71, this._ctx);
			}
			this.state = 672;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 671;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public orderBySpec(): OrderBySpecContext {
		let _localctx: OrderBySpecContext = new OrderBySpecContext(this._ctx, this.state);
		this.enterRule(_localctx, 132, MalloyParser.RULE_orderBySpec);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 676;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.INTEGER_LITERAL:
				{
				this.state = 674;
				this.match(MalloyParser.INTEGER_LITERAL);
				}
				break;
			case MalloyParser.IDENTIFIER:
			case MalloyParser.OBJECT_NAME_LITERAL:
				{
				this.state = 675;
				this.fieldName();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this.state = 679;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.ASC || _la === MalloyParser.DESC) {
				{
				this.state = 678;
				_la = this._input.LA(1);
				if (!(_la === MalloyParser.ASC || _la === MalloyParser.DESC)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public limitStatement(): LimitStatementContext {
		let _localctx: LimitStatementContext = new LimitStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 134, MalloyParser.RULE_limitStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 681;
			this.match(MalloyParser.LIMIT);
			this.state = 682;
			this.match(MalloyParser.INTEGER_LITERAL);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public bySpec(): BySpecContext {
		let _localctx: BySpecContext = new BySpecContext(this._ctx, this.state);
		this.enterRule(_localctx, 136, MalloyParser.RULE_bySpec);
		try {
			this.state = 688;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 75, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 684;
				this.match(MalloyParser.BY);
				this.state = 685;
				this.fieldName();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 686;
				this.match(MalloyParser.BY);
				this.state = 687;
				this.fieldExpr(0);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public topStatement(): TopStatementContext {
		let _localctx: TopStatementContext = new TopStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 138, MalloyParser.RULE_topStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 690;
			this.match(MalloyParser.TOP);
			this.state = 691;
			this.match(MalloyParser.INTEGER_LITERAL);
			this.state = 693;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.BY) {
				{
				this.state = 692;
				this.bySpec();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public indexElement(): IndexElementContext {
		let _localctx: IndexElementContext = new IndexElementContext(this._ctx, this.state);
		this.enterRule(_localctx, 140, MalloyParser.RULE_indexElement);
		let _la: number;
		try {
			this.state = 701;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.IDENTIFIER:
			case MalloyParser.OBJECT_NAME_LITERAL:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 695;
				this.fieldPath();
				this.state = 698;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.DOT) {
					{
					this.state = 696;
					this.match(MalloyParser.DOT);
					this.state = 697;
					this.match(MalloyParser.STAR);
					}
				}

				}
				break;
			case MalloyParser.STAR:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 700;
				this.match(MalloyParser.STAR);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public indexFields(): IndexFieldsContext {
		let _localctx: IndexFieldsContext = new IndexFieldsContext(this._ctx, this.state);
		this.enterRule(_localctx, 142, MalloyParser.RULE_indexFields);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 703;
			this.indexElement();
			this.state = 710;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 100)) & ~0x1F) === 0 && ((1 << (_la - 100)) & ((1 << (MalloyParser.COMMA - 100)) | (1 << (MalloyParser.STAR - 100)) | (1 << (MalloyParser.IDENTIFIER - 100)) | (1 << (MalloyParser.OBJECT_NAME_LITERAL - 100)))) !== 0)) {
				{
				{
				this.state = 705;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.COMMA) {
					{
					this.state = 704;
					this.match(MalloyParser.COMMA);
					}
				}

				this.state = 707;
				this.indexElement();
				}
				}
				this.state = 712;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public indexStatement(): IndexStatementContext {
		let _localctx: IndexStatementContext = new IndexStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 144, MalloyParser.RULE_indexStatement);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 713;
			this.match(MalloyParser.INDEX);
			this.state = 714;
			this.indexFields();
			this.state = 717;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.BY) {
				{
				this.state = 715;
				this.match(MalloyParser.BY);
				this.state = 716;
				this.fieldName();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sampleStatement(): SampleStatementContext {
		let _localctx: SampleStatementContext = new SampleStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 146, MalloyParser.RULE_sampleStatement);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 719;
			this.match(MalloyParser.SAMPLE);
			this.state = 720;
			this.sampleSpec();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sampleSpec(): SampleSpecContext {
		let _localctx: SampleSpecContext = new SampleSpecContext(this._ctx, this.state);
		this.enterRule(_localctx, 148, MalloyParser.RULE_sampleSpec);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 722;
			_la = this._input.LA(1);
			if (!(_la === MalloyParser.FALSE || _la === MalloyParser.TRUE || _la === MalloyParser.PERCENT_LITERAL || _la === MalloyParser.INTEGER_LITERAL)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public aggregate(): AggregateContext {
		let _localctx: AggregateContext = new AggregateContext(this._ctx, this.state);
		this.enterRule(_localctx, 150, MalloyParser.RULE_aggregate);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 724;
			_la = this._input.LA(1);
			if (!(((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & ((1 << (MalloyParser.AVG - 34)) | (1 << (MalloyParser.COUNT - 34)) | (1 << (MalloyParser.MAX - 34)) | (1 << (MalloyParser.MIN - 34)))) !== 0) || _la === MalloyParser.SUM)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public malloyType(): MalloyTypeContext {
		let _localctx: MalloyTypeContext = new MalloyTypeContext(this._ctx, this.state);
		this.enterRule(_localctx, 152, MalloyParser.RULE_malloyType);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 726;
			_la = this._input.LA(1);
			if (!(((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & ((1 << (MalloyParser.BOOLEAN - 35)) | (1 << (MalloyParser.DATE - 35)) | (1 << (MalloyParser.NUMBER - 35)))) !== 0) || _la === MalloyParser.STRING || _la === MalloyParser.TIMESTAMP)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public compareOp(): CompareOpContext {
		let _localctx: CompareOpContext = new CompareOpContext(this._ctx, this.state);
		this.enterRule(_localctx, 154, MalloyParser.RULE_compareOp);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 728;
			_la = this._input.LA(1);
			if (!(((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & ((1 << (MalloyParser.LT - 102)) | (1 << (MalloyParser.GT - 102)) | (1 << (MalloyParser.EQ - 102)) | (1 << (MalloyParser.NE - 102)) | (1 << (MalloyParser.LTE - 102)) | (1 << (MalloyParser.GTE - 102)) | (1 << (MalloyParser.NOT_MATCH - 102)) | (1 << (MalloyParser.MATCH - 102)))) !== 0))) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public literal(): LiteralContext {
		let _localctx: LiteralContext = new LiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 156, MalloyParser.RULE_literal);
		let _la: number;
		try {
			this.state = 737;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.STRING_LITERAL:
				_localctx = new ExprStringContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 730;
				this.match(MalloyParser.STRING_LITERAL);
				}
				break;
			case MalloyParser.INTEGER_LITERAL:
			case MalloyParser.NUMERIC_LITERAL:
				_localctx = new ExprNumberContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 731;
				_la = this._input.LA(1);
				if (!(_la === MalloyParser.INTEGER_LITERAL || _la === MalloyParser.NUMERIC_LITERAL)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				}
				break;
			case MalloyParser.LITERAL_TIMESTAMP:
			case MalloyParser.LITERAL_DAY:
			case MalloyParser.LITERAL_QUARTER:
			case MalloyParser.LITERAL_MONTH:
			case MalloyParser.LITERAL_WEEK:
			case MalloyParser.LITERAL_YEAR:
				_localctx = new ExprTimeContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 732;
				this.dateLiteral();
				}
				break;
			case MalloyParser.NULL:
				_localctx = new ExprNULLContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 733;
				this.match(MalloyParser.NULL);
				}
				break;
			case MalloyParser.FALSE:
			case MalloyParser.TRUE:
				_localctx = new ExprBoolContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 734;
				_la = this._input.LA(1);
				if (!(_la === MalloyParser.FALSE || _la === MalloyParser.TRUE)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				}
				break;
			case MalloyParser.HACKY_REGEX:
				_localctx = new ExprRegexContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 735;
				this.match(MalloyParser.HACKY_REGEX);
				}
				break;
			case MalloyParser.NOW:
				_localctx = new ExprNowContext(_localctx);
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 736;
				this.match(MalloyParser.NOW);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public dateLiteral(): DateLiteralContext {
		let _localctx: DateLiteralContext = new DateLiteralContext(this._ctx, this.state);
		this.enterRule(_localctx, 158, MalloyParser.RULE_dateLiteral);
		try {
			this.state = 745;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.LITERAL_TIMESTAMP:
				_localctx = new LiteralTimestampContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 739;
				this.match(MalloyParser.LITERAL_TIMESTAMP);
				}
				break;
			case MalloyParser.LITERAL_DAY:
				_localctx = new LiteralDayContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 740;
				this.match(MalloyParser.LITERAL_DAY);
				}
				break;
			case MalloyParser.LITERAL_WEEK:
				_localctx = new LiteralWeekContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 741;
				this.match(MalloyParser.LITERAL_WEEK);
				}
				break;
			case MalloyParser.LITERAL_MONTH:
				_localctx = new LiteralMonthContext(_localctx);
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 742;
				this.match(MalloyParser.LITERAL_MONTH);
				}
				break;
			case MalloyParser.LITERAL_QUARTER:
				_localctx = new LiteralQuarterContext(_localctx);
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 743;
				this.match(MalloyParser.LITERAL_QUARTER);
				}
				break;
			case MalloyParser.LITERAL_YEAR:
				_localctx = new LiteralYearContext(_localctx);
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 744;
				this.match(MalloyParser.LITERAL_YEAR);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public tableName(): TableNameContext {
		let _localctx: TableNameContext = new TableNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 160, MalloyParser.RULE_tableName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 747;
			this.match(MalloyParser.STRING_LITERAL);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public id(): IdContext {
		let _localctx: IdContext = new IdContext(this._ctx, this.state);
		this.enterRule(_localctx, 162, MalloyParser.RULE_id);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 749;
			_la = this._input.LA(1);
			if (!(_la === MalloyParser.IDENTIFIER || _la === MalloyParser.OBJECT_NAME_LITERAL)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public timeframe(): TimeframeContext {
		let _localctx: TimeframeContext = new TimeframeContext(this._ctx, this.state);
		this.enterRule(_localctx, 164, MalloyParser.RULE_timeframe);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 751;
			_la = this._input.LA(1);
			if (!(((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & ((1 << (MalloyParser.DAY - 42)) | (1 << (MalloyParser.HOUR - 42)) | (1 << (MalloyParser.MINUTE - 42)) | (1 << (MalloyParser.MONTH - 42)) | (1 << (MalloyParser.QUARTER - 42)) | (1 << (MalloyParser.SECOND - 42)))) !== 0) || _la === MalloyParser.WEEK || _la === MalloyParser.YEAR)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public ungroup(): UngroupContext {
		let _localctx: UngroupContext = new UngroupContext(this._ctx, this.state);
		this.enterRule(_localctx, 166, MalloyParser.RULE_ungroup);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 753;
			_la = this._input.LA(1);
			if (!(_la === MalloyParser.ALL || _la === MalloyParser.EXCLUDE)) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public fieldExpr(): FieldExprContext;
	public fieldExpr(_p: number): FieldExprContext;
	// @RuleVersion(0)
	public fieldExpr(_p?: number): FieldExprContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let _localctx: FieldExprContext = new FieldExprContext(this._ctx, _parentState);
		let _prevctx: FieldExprContext = _localctx;
		let _startState: number = 168;
		this.enterRecursionRule(_localctx, 168, MalloyParser.RULE_fieldExpr, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 815;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 89, this._ctx) ) {
			case 1:
				{
				_localctx = new ExprFieldPathContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;

				this.state = 756;
				this.fieldPath();
				}
				break;

			case 2:
				{
				_localctx = new ExprLiteralContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 757;
				this.literal();
				}
				break;

			case 3:
				{
				_localctx = new ExprMinusContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 758;
				this.match(MalloyParser.MINUS);
				this.state = 759;
				this.fieldExpr(20);
				}
				break;

			case 4:
				{
				_localctx = new ExprNotContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 760;
				this.match(MalloyParser.NOT);
				this.state = 761;
				this.fieldExpr(9);
				}
				break;

			case 5:
				{
				_localctx = new ExprCastContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 762;
				this.match(MalloyParser.CAST);
				this.state = 763;
				this.match(MalloyParser.OPAREN);
				this.state = 764;
				this.fieldExpr(0);
				this.state = 765;
				this.match(MalloyParser.AS);
				this.state = 766;
				this.malloyType();
				this.state = 767;
				this.match(MalloyParser.CPAREN);
				}
				break;

			case 6:
				{
				_localctx = new ExprCountDisinctContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 769;
				this.match(MalloyParser.COUNT);
				this.state = 770;
				this.match(MalloyParser.OPAREN);
				this.state = 771;
				this.match(MalloyParser.DISTINCT);
				this.state = 772;
				this.fieldExpr(0);
				this.state = 773;
				this.match(MalloyParser.CPAREN);
				}
				break;

			case 7:
				{
				_localctx = new ExprAggregateContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 778;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.IDENTIFIER || _la === MalloyParser.OBJECT_NAME_LITERAL) {
					{
					this.state = 775;
					this.fieldPath();
					this.state = 776;
					this.match(MalloyParser.DOT);
					}
				}

				this.state = 780;
				this.aggregate();
				this.state = 781;
				this.match(MalloyParser.OPAREN);
				this.state = 784;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case MalloyParser.ALL:
				case MalloyParser.AVG:
				case MalloyParser.CAST:
				case MalloyParser.COUNT:
				case MalloyParser.DAY:
				case MalloyParser.EXCLUDE:
				case MalloyParser.FALSE:
				case MalloyParser.HOUR:
				case MalloyParser.MAX:
				case MalloyParser.MIN:
				case MalloyParser.MINUTE:
				case MalloyParser.MONTH:
				case MalloyParser.NOT:
				case MalloyParser.NOW:
				case MalloyParser.NULL:
				case MalloyParser.PICK:
				case MalloyParser.QUARTER:
				case MalloyParser.SECOND:
				case MalloyParser.SUM:
				case MalloyParser.TRUE:
				case MalloyParser.WEEK:
				case MalloyParser.YEAR:
				case MalloyParser.HACKY_REGEX:
				case MalloyParser.STRING_LITERAL:
				case MalloyParser.OPAREN:
				case MalloyParser.MINUS:
				case MalloyParser.LITERAL_TIMESTAMP:
				case MalloyParser.LITERAL_DAY:
				case MalloyParser.LITERAL_QUARTER:
				case MalloyParser.LITERAL_MONTH:
				case MalloyParser.LITERAL_WEEK:
				case MalloyParser.LITERAL_YEAR:
				case MalloyParser.IDENTIFIER:
				case MalloyParser.INTEGER_LITERAL:
				case MalloyParser.NUMERIC_LITERAL:
				case MalloyParser.OBJECT_NAME_LITERAL:
					{
					this.state = 782;
					this.fieldExpr(0);
					}
					break;
				case MalloyParser.STAR:
					{
					this.state = 783;
					this.match(MalloyParser.STAR);
					}
					break;
				case MalloyParser.CPAREN:
					break;
				default:
					break;
				}
				this.state = 786;
				this.match(MalloyParser.CPAREN);
				}
				break;

			case 8:
				{
				_localctx = new ExprExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 788;
				this.match(MalloyParser.OPAREN);
				this.state = 789;
				this.partialAllowedFieldExpr();
				this.state = 790;
				this.match(MalloyParser.CPAREN);
				}
				break;

			case 9:
				{
				_localctx = new ExprFuncContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 794;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case MalloyParser.IDENTIFIER:
				case MalloyParser.OBJECT_NAME_LITERAL:
					{
					this.state = 792;
					this.id();
					}
					break;
				case MalloyParser.DAY:
				case MalloyParser.HOUR:
				case MalloyParser.MINUTE:
				case MalloyParser.MONTH:
				case MalloyParser.QUARTER:
				case MalloyParser.SECOND:
				case MalloyParser.WEEK:
				case MalloyParser.YEAR:
					{
					this.state = 793;
					this.timeframe();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 796;
				this.match(MalloyParser.OPAREN);
				{
				this.state = 798;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (MalloyParser.ALL - 30)) | (1 << (MalloyParser.AVG - 30)) | (1 << (MalloyParser.CAST - 30)) | (1 << (MalloyParser.COUNT - 30)) | (1 << (MalloyParser.DAY - 30)) | (1 << (MalloyParser.EXCLUDE - 30)) | (1 << (MalloyParser.FALSE - 30)) | (1 << (MalloyParser.HOUR - 30)) | (1 << (MalloyParser.MAX - 30)) | (1 << (MalloyParser.MIN - 30)) | (1 << (MalloyParser.MINUTE - 30)) | (1 << (MalloyParser.MONTH - 30)))) !== 0) || ((((_la - 62)) & ~0x1F) === 0 && ((1 << (_la - 62)) & ((1 << (MalloyParser.NOT - 62)) | (1 << (MalloyParser.NOW - 62)) | (1 << (MalloyParser.NULL - 62)) | (1 << (MalloyParser.PICK - 62)) | (1 << (MalloyParser.QUARTER - 62)) | (1 << (MalloyParser.SECOND - 62)) | (1 << (MalloyParser.SUM - 62)) | (1 << (MalloyParser.TRUE - 62)) | (1 << (MalloyParser.WEEK - 62)) | (1 << (MalloyParser.YEAR - 62)) | (1 << (MalloyParser.HACKY_REGEX - 62)) | (1 << (MalloyParser.STRING_LITERAL - 62)) | (1 << (MalloyParser.OPAREN - 62)))) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & ((1 << (MalloyParser.MINUS - 109)) | (1 << (MalloyParser.LITERAL_TIMESTAMP - 109)) | (1 << (MalloyParser.LITERAL_DAY - 109)) | (1 << (MalloyParser.LITERAL_QUARTER - 109)) | (1 << (MalloyParser.LITERAL_MONTH - 109)) | (1 << (MalloyParser.LITERAL_WEEK - 109)) | (1 << (MalloyParser.LITERAL_YEAR - 109)) | (1 << (MalloyParser.IDENTIFIER - 109)) | (1 << (MalloyParser.INTEGER_LITERAL - 109)) | (1 << (MalloyParser.NUMERIC_LITERAL - 109)) | (1 << (MalloyParser.OBJECT_NAME_LITERAL - 109)))) !== 0)) {
					{
					this.state = 797;
					this.argumentList();
					}
				}

				}
				this.state = 800;
				this.match(MalloyParser.CPAREN);
				}
				break;

			case 10:
				{
				_localctx = new ExprPickContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 802;
				this.pickStatement();
				}
				break;

			case 11:
				{
				_localctx = new ExprUngroupContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 803;
				this.ungroup();
				this.state = 804;
				this.match(MalloyParser.OPAREN);
				this.state = 805;
				this.fieldExpr(0);
				this.state = 810;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === MalloyParser.COMMA) {
					{
					{
					this.state = 806;
					this.match(MalloyParser.COMMA);
					this.state = 807;
					this.fieldName();
					}
					}
					this.state = 812;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 813;
				this.match(MalloyParser.CPAREN);
				}
				break;
			}
			this._ctx._stop = this._input.tryLT(-1);
			this.state = 859;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 91, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = _localctx;
					{
					this.state = 857;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 90, this._ctx) ) {
					case 1:
						{
						_localctx = new ExprMulDivContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 817;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 818;
						_la = this._input.LA(1);
						if (!(((((_la - 110)) & ~0x1F) === 0 && ((1 << (_la - 110)) & ((1 << (MalloyParser.STAR - 110)) | (1 << (MalloyParser.SLASH - 110)) | (1 << (MalloyParser.PERCENT - 110)))) !== 0))) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 819;
						this.fieldExpr(17);
						}
						break;

					case 2:
						{
						_localctx = new ExprAddSubContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 820;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 821;
						_la = this._input.LA(1);
						if (!(_la === MalloyParser.PLUS || _la === MalloyParser.MINUS)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 822;
						this.fieldExpr(16);
						}
						break;

					case 3:
						{
						_localctx = new ExprRangeContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 823;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 824;
						this.match(MalloyParser.TO);
						this.state = 825;
						this.fieldExpr(15);
						}
						break;

					case 4:
						{
						_localctx = new ExprCompareContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 826;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 827;
						this.compareOp();
						this.state = 828;
						this.fieldExpr(12);
						}
						break;

					case 5:
						{
						_localctx = new ExprLogicalContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 830;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 831;
						_la = this._input.LA(1);
						if (!(_la === MalloyParser.AND || _la === MalloyParser.OR)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 832;
						this.fieldExpr(9);
						}
						break;

					case 6:
						{
						_localctx = new ExprFilterContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 833;
						if (!(this.precpred(this._ctx, 22))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 22)");
						}
						this.state = 834;
						this.match(MalloyParser.OCURLY);
						this.state = 835;
						this.filteredBy();
						this.state = 836;
						this.match(MalloyParser.CCURLY);
						}
						break;

					case 7:
						{
						_localctx = new ExprDurationContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 838;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 839;
						this.timeframe();
						}
						break;

					case 8:
						{
						_localctx = new ExprTimeTruncContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 840;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 841;
						this.match(MalloyParser.DOT);
						this.state = 842;
						this.timeframe();
						}
						break;

					case 9:
						{
						_localctx = new ExprSafeCastContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 843;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 844;
						this.match(MalloyParser.DOUBLECOLON);
						this.state = 845;
						this.malloyType();
						}
						break;

					case 10:
						{
						_localctx = new ExprForRangeContext(new FieldExprContext(_parentctx, _parentState));
						(_localctx as ExprForRangeContext)._startAt = _prevctx;
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 846;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 847;
						this.match(MalloyParser.FOR);
						this.state = 848;
						(_localctx as ExprForRangeContext)._duration = this.fieldExpr(0);
						this.state = 849;
						this.timeframe();
						}
						break;

					case 11:
						{
						_localctx = new ExprLogicalTreeContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 851;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 852;
						_la = this._input.LA(1);
						if (!(_la === MalloyParser.AMPER || _la === MalloyParser.BAR)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 853;
						this.partialAllowedFieldExpr();
						}
						break;

					case 12:
						{
						_localctx = new ExprApplyContext(new FieldExprContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, MalloyParser.RULE_fieldExpr);
						this.state = 854;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 855;
						_la = this._input.LA(1);
						if (!(_la === MalloyParser.QMARK || _la === MalloyParser.COLON)) {
						this._errHandler.recoverInline(this);
						} else {
							if (this._input.LA(1) === Token.EOF) {
								this.matchedEOF = true;
							}

							this._errHandler.reportMatch(this);
							this.consume();
						}
						this.state = 856;
						this.partialAllowedFieldExpr();
						}
						break;
					}
					}
				}
				this.state = 861;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 91, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.unrollRecursionContexts(_parentctx);
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public partialAllowedFieldExpr(): PartialAllowedFieldExprContext {
		let _localctx: PartialAllowedFieldExprContext = new PartialAllowedFieldExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 170, MalloyParser.RULE_partialAllowedFieldExpr);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 863;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & ((1 << (MalloyParser.LT - 102)) | (1 << (MalloyParser.GT - 102)) | (1 << (MalloyParser.EQ - 102)) | (1 << (MalloyParser.NE - 102)) | (1 << (MalloyParser.LTE - 102)) | (1 << (MalloyParser.GTE - 102)) | (1 << (MalloyParser.NOT_MATCH - 102)) | (1 << (MalloyParser.MATCH - 102)))) !== 0)) {
				{
				this.state = 862;
				this.compareOp();
				}
			}

			this.state = 865;
			this.fieldExpr(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public pickStatement(): PickStatementContext {
		let _localctx: PickStatementContext = new PickStatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 172, MalloyParser.RULE_pickStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 868;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 867;
					this.pick();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 870;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 93, this._ctx);
			} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
			this.state = 874;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 94, this._ctx) ) {
			case 1:
				{
				this.state = 872;
				this.match(MalloyParser.ELSE);
				this.state = 873;
				_localctx._pickElse = this.fieldExpr(0);
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public pick(): PickContext {
		let _localctx: PickContext = new PickContext(this._ctx, this.state);
		this.enterRule(_localctx, 174, MalloyParser.RULE_pick);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 876;
			this.match(MalloyParser.PICK);
			this.state = 878;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 30)) & ~0x1F) === 0 && ((1 << (_la - 30)) & ((1 << (MalloyParser.ALL - 30)) | (1 << (MalloyParser.AVG - 30)) | (1 << (MalloyParser.CAST - 30)) | (1 << (MalloyParser.COUNT - 30)) | (1 << (MalloyParser.DAY - 30)) | (1 << (MalloyParser.EXCLUDE - 30)) | (1 << (MalloyParser.FALSE - 30)) | (1 << (MalloyParser.HOUR - 30)) | (1 << (MalloyParser.MAX - 30)) | (1 << (MalloyParser.MIN - 30)) | (1 << (MalloyParser.MINUTE - 30)) | (1 << (MalloyParser.MONTH - 30)))) !== 0) || ((((_la - 62)) & ~0x1F) === 0 && ((1 << (_la - 62)) & ((1 << (MalloyParser.NOT - 62)) | (1 << (MalloyParser.NOW - 62)) | (1 << (MalloyParser.NULL - 62)) | (1 << (MalloyParser.PICK - 62)) | (1 << (MalloyParser.QUARTER - 62)) | (1 << (MalloyParser.SECOND - 62)) | (1 << (MalloyParser.SUM - 62)) | (1 << (MalloyParser.TRUE - 62)) | (1 << (MalloyParser.WEEK - 62)) | (1 << (MalloyParser.YEAR - 62)) | (1 << (MalloyParser.HACKY_REGEX - 62)) | (1 << (MalloyParser.STRING_LITERAL - 62)) | (1 << (MalloyParser.OPAREN - 62)))) !== 0) || ((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & ((1 << (MalloyParser.MINUS - 109)) | (1 << (MalloyParser.LITERAL_TIMESTAMP - 109)) | (1 << (MalloyParser.LITERAL_DAY - 109)) | (1 << (MalloyParser.LITERAL_QUARTER - 109)) | (1 << (MalloyParser.LITERAL_MONTH - 109)) | (1 << (MalloyParser.LITERAL_WEEK - 109)) | (1 << (MalloyParser.LITERAL_YEAR - 109)) | (1 << (MalloyParser.IDENTIFIER - 109)) | (1 << (MalloyParser.INTEGER_LITERAL - 109)) | (1 << (MalloyParser.NUMERIC_LITERAL - 109)) | (1 << (MalloyParser.OBJECT_NAME_LITERAL - 109)))) !== 0)) {
				{
				this.state = 877;
				_localctx._pickValue = this.fieldExpr(0);
				}
			}

			this.state = 880;
			this.match(MalloyParser.WHEN);
			this.state = 881;
			_localctx._pickWhen = this.partialAllowedFieldExpr();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public argumentList(): ArgumentListContext {
		let _localctx: ArgumentListContext = new ArgumentListContext(this._ctx, this.state);
		this.enterRule(_localctx, 176, MalloyParser.RULE_argumentList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 883;
			this.fieldExpr(0);
			this.state = 888;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 96, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 884;
					this.match(MalloyParser.COMMA);
					this.state = 885;
					this.fieldExpr(0);
					}
					}
				}
				this.state = 890;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 96, this._ctx);
			}
			this.state = 892;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 891;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldNameList(): FieldNameListContext {
		let _localctx: FieldNameListContext = new FieldNameListContext(this._ctx, this.state);
		this.enterRule(_localctx, 178, MalloyParser.RULE_fieldNameList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 894;
			this.fieldName();
			this.state = 901;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 100)) & ~0x1F) === 0 && ((1 << (_la - 100)) & ((1 << (MalloyParser.COMMA - 100)) | (1 << (MalloyParser.IDENTIFIER - 100)) | (1 << (MalloyParser.OBJECT_NAME_LITERAL - 100)))) !== 0)) {
				{
				{
				this.state = 896;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.COMMA) {
					{
					this.state = 895;
					this.match(MalloyParser.COMMA);
					}
				}

				this.state = 898;
				this.fieldName();
				}
				}
				this.state = 903;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldCollection(): FieldCollectionContext {
		let _localctx: FieldCollectionContext = new FieldCollectionContext(this._ctx, this.state);
		this.enterRule(_localctx, 180, MalloyParser.RULE_fieldCollection);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 904;
			this.collectionMember();
			this.state = 911;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 101, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 906;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la === MalloyParser.COMMA) {
						{
						this.state = 905;
						this.match(MalloyParser.COMMA);
						}
					}

					this.state = 908;
					this.collectionMember();
					}
					}
				}
				this.state = 913;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 101, this._ctx);
			}
			this.state = 915;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === MalloyParser.COMMA) {
				{
				this.state = 914;
				this.match(MalloyParser.COMMA);
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public collectionMember(): CollectionMemberContext {
		let _localctx: CollectionMemberContext = new CollectionMemberContext(this._ctx, this.state);
		this.enterRule(_localctx, 182, MalloyParser.RULE_collectionMember);
		let _la: number;
		try {
			this.state = 925;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 104, this._ctx) ) {
			case 1:
				_localctx = new NameMemberContext(_localctx);
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 917;
				this.fieldPath();
				}
				break;

			case 2:
				_localctx = new WildMemberContext(_localctx);
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 921;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la === MalloyParser.IDENTIFIER || _la === MalloyParser.OBJECT_NAME_LITERAL) {
					{
					this.state = 918;
					this.fieldPath();
					this.state = 919;
					this.match(MalloyParser.DOT);
					}
				}

				this.state = 923;
				_la = this._input.LA(1);
				if (!(_la === MalloyParser.STAR || _la === MalloyParser.STARSTAR)) {
				this._errHandler.recoverInline(this);
				} else {
					if (this._input.LA(1) === Token.EOF) {
						this.matchedEOF = true;
					}

					this._errHandler.reportMatch(this);
					this.consume();
				}
				}
				break;

			case 3:
				_localctx = new NewMemberContext(_localctx);
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 924;
				this.fieldDef();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldPath(): FieldPathContext {
		let _localctx: FieldPathContext = new FieldPathContext(this._ctx, this.state);
		this.enterRule(_localctx, 184, MalloyParser.RULE_fieldPath);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 927;
			this.fieldName();
			this.state = 932;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 105, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 928;
					this.match(MalloyParser.DOT);
					this.state = 929;
					this.fieldName();
					}
					}
				}
				this.state = 934;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 105, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public joinName(): JoinNameContext {
		let _localctx: JoinNameContext = new JoinNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 186, MalloyParser.RULE_joinName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 935;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fieldName(): FieldNameContext {
		let _localctx: FieldNameContext = new FieldNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 188, MalloyParser.RULE_fieldName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 937;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public justExpr(): JustExprContext {
		let _localctx: JustExprContext = new JustExprContext(this._ctx, this.state);
		this.enterRule(_localctx, 190, MalloyParser.RULE_justExpr);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 939;
			this.fieldExpr(0);
			this.state = 940;
			this.match(MalloyParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public json(): JsonContext {
		let _localctx: JsonContext = new JsonContext(this._ctx, this.state);
		this.enterRule(_localctx, 192, MalloyParser.RULE_json);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 942;
			this.jsonValue();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public jsonValue(): JsonValueContext {
		let _localctx: JsonValueContext = new JsonValueContext(this._ctx, this.state);
		this.enterRule(_localctx, 194, MalloyParser.RULE_jsonValue);
		try {
			this.state = 952;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case MalloyParser.JSON_STRING:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 944;
				this.match(MalloyParser.JSON_STRING);
				}
				break;
			case MalloyParser.INTEGER_LITERAL:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 945;
				this.match(MalloyParser.INTEGER_LITERAL);
				}
				break;
			case MalloyParser.NUMERIC_LITERAL:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 946;
				this.match(MalloyParser.NUMERIC_LITERAL);
				}
				break;
			case MalloyParser.OCURLY:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 947;
				this.jsonObject();
				}
				break;
			case MalloyParser.OBRACK:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 948;
				this.jsonArray();
				}
				break;
			case MalloyParser.TRUE:
				this.enterOuterAlt(_localctx, 6);
				{
				this.state = 949;
				this.match(MalloyParser.TRUE);
				}
				break;
			case MalloyParser.FALSE:
				this.enterOuterAlt(_localctx, 7);
				{
				this.state = 950;
				this.match(MalloyParser.FALSE);
				}
				break;
			case MalloyParser.NULL:
				this.enterOuterAlt(_localctx, 8);
				{
				this.state = 951;
				this.match(MalloyParser.NULL);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public jsonObject(): JsonObjectContext {
		let _localctx: JsonObjectContext = new JsonObjectContext(this._ctx, this.state);
		this.enterRule(_localctx, 196, MalloyParser.RULE_jsonObject);
		let _la: number;
		try {
			this.state = 967;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 108, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 954;
				this.match(MalloyParser.OCURLY);
				this.state = 955;
				this.jsonProperty();
				this.state = 960;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === MalloyParser.COMMA) {
					{
					{
					this.state = 956;
					this.match(MalloyParser.COMMA);
					this.state = 957;
					this.jsonProperty();
					}
					}
					this.state = 962;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 963;
				this.match(MalloyParser.CCURLY);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 965;
				this.match(MalloyParser.OCURLY);
				this.state = 966;
				this.match(MalloyParser.CCURLY);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public jsonProperty(): JsonPropertyContext {
		let _localctx: JsonPropertyContext = new JsonPropertyContext(this._ctx, this.state);
		this.enterRule(_localctx, 198, MalloyParser.RULE_jsonProperty);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 969;
			this.match(MalloyParser.JSON_STRING);
			this.state = 970;
			this.match(MalloyParser.COLON);
			this.state = 971;
			this.jsonValue();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public jsonArray(): JsonArrayContext {
		let _localctx: JsonArrayContext = new JsonArrayContext(this._ctx, this.state);
		this.enterRule(_localctx, 200, MalloyParser.RULE_jsonArray);
		let _la: number;
		try {
			this.state = 986;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 110, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 973;
				this.match(MalloyParser.OBRACK);
				this.state = 974;
				this.jsonValue();
				this.state = 979;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la === MalloyParser.COMMA) {
					{
					{
					this.state = 975;
					this.match(MalloyParser.COMMA);
					this.state = 976;
					this.jsonValue();
					}
					}
					this.state = 981;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 982;
				this.match(MalloyParser.CBRACK);
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 984;
				this.match(MalloyParser.OBRACK);
				this.state = 985;
				this.match(MalloyParser.CBRACK);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public sqlExploreNameRef(): SqlExploreNameRefContext {
		let _localctx: SqlExploreNameRefContext = new SqlExploreNameRefContext(this._ctx, this.state);
		this.enterRule(_localctx, 202, MalloyParser.RULE_sqlExploreNameRef);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 988;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public nameSQLBlock(): NameSQLBlockContext {
		let _localctx: NameSQLBlockContext = new NameSQLBlockContext(this._ctx, this.state);
		this.enterRule(_localctx, 204, MalloyParser.RULE_nameSQLBlock);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 990;
			this.id();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public connectionName(): ConnectionNameContext {
		let _localctx: ConnectionNameContext = new ConnectionNameContext(this._ctx, this.state);
		this.enterRule(_localctx, 206, MalloyParser.RULE_connectionName);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 992;
			this.match(MalloyParser.JSON_STRING);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public sempred(_localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 84:
			return this.fieldExpr_sempred(_localctx as FieldExprContext, predIndex);
		}
		return true;
	}
	private fieldExpr_sempred(_localctx: FieldExprContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 16);

		case 1:
			return this.precpred(this._ctx, 15);

		case 2:
			return this.precpred(this._ctx, 14);

		case 3:
			return this.precpred(this._ctx, 11);

		case 4:
			return this.precpred(this._ctx, 8);

		case 5:
			return this.precpred(this._ctx, 22);

		case 6:
			return this.precpred(this._ctx, 19);

		case 7:
			return this.precpred(this._ctx, 18);

		case 8:
			return this.precpred(this._ctx, 17);

		case 9:
			return this.precpred(this._ctx, 13);

		case 10:
			return this.precpred(this._ctx, 12);

		case 11:
			return this.precpred(this._ctx, 10);
		}
		return true;
	}

	private static readonly _serializedATNSegments: number = 2;
	private static readonly _serializedATNSegment0: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\x8B\u03E5\x04" +
		"\x02\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04" +
		"\x07\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r" +
		"\x04\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12" +
		"\x04\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17" +
		"\x04\x18\t\x18\x04\x19\t\x19\x04\x1A\t\x1A\x04\x1B\t\x1B\x04\x1C\t\x1C" +
		"\x04\x1D\t\x1D\x04\x1E\t\x1E\x04\x1F\t\x1F\x04 \t \x04!\t!\x04\"\t\"\x04" +
		"#\t#\x04$\t$\x04%\t%\x04&\t&\x04\'\t\'\x04(\t(\x04)\t)\x04*\t*\x04+\t" +
		"+\x04,\t,\x04-\t-\x04.\t.\x04/\t/\x040\t0\x041\t1\x042\t2\x043\t3\x04" +
		"4\t4\x045\t5\x046\t6\x047\t7\x048\t8\x049\t9\x04:\t:\x04;\t;\x04<\t<\x04" +
		"=\t=\x04>\t>\x04?\t?\x04@\t@\x04A\tA\x04B\tB\x04C\tC\x04D\tD\x04E\tE\x04" +
		"F\tF\x04G\tG\x04H\tH\x04I\tI\x04J\tJ\x04K\tK\x04L\tL\x04M\tM\x04N\tN\x04" +
		"O\tO\x04P\tP\x04Q\tQ\x04R\tR\x04S\tS\x04T\tT\x04U\tU\x04V\tV\x04W\tW\x04" +
		"X\tX\x04Y\tY\x04Z\tZ\x04[\t[\x04\\\t\\\x04]\t]\x04^\t^\x04_\t_\x04`\t" +
		"`\x04a\ta\x04b\tb\x04c\tc\x04d\td\x04e\te\x04f\tf\x04g\tg\x04h\th\x04" +
		"i\ti\x03\x02\x03\x02\x07\x02\xD5\n\x02\f\x02\x0E\x02\xD8\v\x02\x03\x02" +
		"\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x05\x03\xE0\n\x03\x03\x04\x03" +
		"\x04\x03\x04\x03\x05\x03\x05\x03\x06\x03\x06\x03\x06\x03\x06\x05\x06\xEB" +
		"\n\x06\x03\x07\x03\x07\x03\b\x03\b\x03\b\x03\b\x05\b\xF3\n\b\x03\b\x03" +
		"\b\x03\t\x03\t\x06\t\xF9\n\t\r\t\x0E\t\xFA\x03\t\x03\t\x03\n\x03\n\x03" +
		"\n\x03\n\x05\n\u0103\n\n\x03\v\x03\v\x07\v\u0107\n\v\f\v\x0E\v\u010A\v" +
		"\v\x03\v\x03\v\x03\f\x03\f\x03\f\x03\f\x03\r\x03\r\x03\r\x03\x0E\x03\x0E" +
		"\x03\x0F\x03\x0F\x05\x0F\u0119\n\x0F\x03\x0F\x07\x0F\u011C\n\x0F\f\x0F" +
		"\x0E\x0F\u011F\v\x0F\x03\x0F\x05\x0F\u0122\n\x0F\x03\x10\x03\x10\x03\x10" +
		"\x03\x10\x03\x11\x03\x11\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12" +
		"\x03\x12\x05\x12\u0131\n\x12\x03\x12\x05\x12\u0134\n\x12\x03\x12\x07\x12" +
		"\u0137\n\x12\f\x12\x0E\x12\u013A\v\x12\x05\x12\u013C\n\x12\x03\x13\x03" +
		"\x13\x07\x13\u0140\n\x13\f\x13\x0E\x13\u0143\v\x13\x03\x14\x03\x14\x03" +
		"\x14\x05\x14\u0148\n\x14\x03\x14\x05\x14\u014B\n\x14\x05\x14\u014D\n\x14" +
		"\x03\x15\x03\x15\x03\x15\x03\x16\x03\x16\x03\x16\x03\x16\x03\x16\x03\x17" +
		"\x03\x17\x03\x17\x03\x17\x07\x17\u015B\n\x17\f\x17\x0E\x17\u015E\v\x17" +
		"\x03\x17\x05\x17\u0161\n\x17\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03" +
		"\x19\x03\x19\x03\x1A\x03\x1A\x03\x1B\x03\x1B\x05\x1B\u016E\n\x1B\x03\x1B" +
		"\x07\x1B\u0171\n\x1B\f\x1B\x0E\x1B\u0174\v\x1B\x03\x1B\x05\x1B\u0177\n" +
		"\x1B\x03\x1C\x03\x1C\x03\x1C\x03\x1C\x03\x1D\x03\x1D\x05\x1D\u017F\n\x1D" +
		"\x03\x1D\x05\x1D\u0182\n\x1D\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03" +
		"\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x03\x1E\x05\x1E\u0190\n\x1E" +
		"\x03\x1F\x03\x1F\x03 \x03 \x03!\x03!\x03!\x07!\u0199\n!\f!\x0E!\u019C" +
		"\v!\x03!\x03!\x05!\u01A0\n!\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"" +
		"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x03\"\x05\"\u01B1\n\"\x03#" +
		"\x03#\x05#\u01B5\n#\x03#\x07#\u01B8\n#\f#\x0E#\u01BB\v#\x03#\x05#\u01BE" +
		"\n#\x03$\x03$\x03$\x03$\x03%\x03%\x05%\u01C6\n%\x03%\x07%\u01C9\n%\f%" +
		"\x0E%\u01CC\v%\x03%\x05%\u01CF\n%\x03&\x03&\x05&\u01D3\n&\x03&\x07&\u01D6" +
		"\n&\f&\x0E&\u01D9\v&\x03&\x05&\u01DC\n&\x03\'\x03\'\x03\'\x03\'\x03(\x03" +
		"(\x03)\x03)\x03*\x03*\x03+\x03+\x03+\x05+\u01EB\n+\x03+\x07+\u01EE\n+" +
		"\f+\x0E+\u01F1\v+\x03+\x05+\u01F4\n+\x03,\x03,\x03,\x03,\x03,\x03,\x05" +
		",\u01FC\n,\x03-\x03-\x05-\u0200\n-\x03-\x07-\u0203\n-\f-\x0E-\u0206\v" +
		"-\x03-\x05-\u0209\n-\x03.\x03.\x03.\x05.\u020E\n.\x03.\x03.\x03.\x03." +
		"\x03.\x03.\x05.\u0216\n.\x03.\x03.\x05.\u021A\n.\x05.\u021C\n.\x03/\x03" +
		"/\x030\x030\x050\u0222\n0\x031\x031\x031\x051\u0227\n1\x032\x032\x032" +
		"\x072\u022C\n2\f2\x0E2\u022F\v2\x032\x052\u0232\n2\x033\x033\x033\x03" +
		"4\x034\x034\x035\x035\x055\u023C\n5\x035\x075\u023F\n5\f5\x0E5\u0242\v" +
		"5\x035\x055\u0245\n5\x036\x036\x037\x037\x037\x037\x038\x038\x038\x03" +
		"8\x038\x038\x038\x038\x038\x038\x038\x038\x038\x058\u025A\n8\x039\x03" +
		"9\x039\x03:\x03:\x05:\u0261\n:\x03:\x07:\u0264\n:\f:\x0E:\u0267\v:\x03" +
		":\x05:\u026A\n:\x03;\x03;\x03<\x03<\x05<\u0270\n<\x03=\x03=\x03=\x03>" +
		"\x03>\x05>\u0277\n>\x03>\x07>\u027A\n>\f>\x0E>\u027D\v>\x03>\x05>\u0280" +
		"\n>\x03?\x03?\x05?\u0284\n?\x03?\x05?\u0287\n?\x03?\x03?\x03?\x03?\x05" +
		"?\u028D\n?\x03@\x03@\x03@\x03A\x03A\x03A\x03B\x03B\x03B\x03C\x03C\x05" +
		"C\u029A\nC\x03C\x07C\u029D\nC\fC\x0EC\u02A0\vC\x03C\x05C\u02A3\nC\x03" +
		"D\x03D\x05D\u02A7\nD\x03D\x05D\u02AA\nD\x03E\x03E\x03E\x03F\x03F\x03F" +
		"\x03F\x05F\u02B3\nF\x03G\x03G\x03G\x05G\u02B8\nG\x03H\x03H\x03H\x05H\u02BD" +
		"\nH\x03H\x05H\u02C0\nH\x03I\x03I\x05I\u02C4\nI\x03I\x07I\u02C7\nI\fI\x0E" +
		"I\u02CA\vI\x03J\x03J\x03J\x03J\x05J\u02D0\nJ\x03K\x03K\x03K\x03L\x03L" +
		"\x03M\x03M\x03N\x03N\x03O\x03O\x03P\x03P\x03P\x03P\x03P\x03P\x03P\x05" +
		"P\u02E4\nP\x03Q\x03Q\x03Q\x03Q\x03Q\x03Q\x05Q\u02EC\nQ\x03R\x03R\x03S" +
		"\x03S\x03T\x03T\x03U\x03U\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03" +
		"V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03" +
		"V\x05V\u030D\nV\x03V\x03V\x03V\x03V\x05V\u0313\nV\x03V\x03V\x03V\x03V" +
		"\x03V\x03V\x03V\x03V\x05V\u031D\nV\x03V\x03V\x05V\u0321\nV\x03V\x03V\x03" +
		"V\x03V\x03V\x03V\x03V\x03V\x07V\u032B\nV\fV\x0EV\u032E\vV\x03V\x03V\x05" +
		"V\u0332\nV\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03" +
		"V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03" +
		"V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03V\x03" +
		"V\x07V\u035C\nV\fV\x0EV\u035F\vV\x03W\x05W\u0362\nW\x03W\x03W\x03X\x06" +
		"X\u0367\nX\rX\x0EX\u0368\x03X\x03X\x05X\u036D\nX\x03Y\x03Y\x05Y\u0371" +
		"\nY\x03Y\x03Y\x03Y\x03Z\x03Z\x03Z\x07Z\u0379\nZ\fZ\x0EZ\u037C\vZ\x03Z" +
		"\x05Z\u037F\nZ\x03[\x03[\x05[\u0383\n[\x03[\x07[\u0386\n[\f[\x0E[\u0389" +
		"\v[\x03\\\x03\\\x05\\\u038D\n\\\x03\\\x07\\\u0390\n\\\f\\\x0E\\\u0393" +
		"\v\\\x03\\\x05\\\u0396\n\\\x03]\x03]\x03]\x03]\x05]\u039C\n]\x03]\x03" +
		"]\x05]\u03A0\n]\x03^\x03^\x03^\x07^\u03A5\n^\f^\x0E^\u03A8\v^\x03_\x03" +
		"_\x03`\x03`\x03a\x03a\x03a\x03b\x03b\x03c\x03c\x03c\x03c\x03c\x03c\x03" +
		"c\x03c\x05c\u03BB\nc\x03d\x03d\x03d\x03d\x07d\u03C1\nd\fd\x0Ed\u03C4\v" +
		"d\x03d\x03d\x03d\x03d\x05d\u03CA\nd\x03e\x03e\x03e\x03e\x03f\x03f\x03" +
		"f\x03f\x07f\u03D4\nf\ff\x0Ef\u03D7\vf\x03f\x03f\x03f\x03f\x05f\u03DD\n" +
		"f\x03g\x03g\x03h\x03h\x03i\x03i\x03i\x02\x02\x03\xAAj\x02\x02\x04\x02" +
		"\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02\x14\x02\x16\x02\x18" +
		"\x02\x1A\x02\x1C\x02\x1E\x02 \x02\"\x02$\x02&\x02(\x02*\x02,\x02.\x02" +
		"0\x022\x024\x026\x028\x02:\x02<\x02>\x02@\x02B\x02D\x02F\x02H\x02J\x02" +
		"L\x02N\x02P\x02R\x02T\x02V\x02X\x02Z\x02\\\x02^\x02`\x02b\x02d\x02f\x02" +
		"h\x02j\x02l\x02n\x02p\x02r\x02t\x02v\x02x\x02z\x02|\x02~\x02\x80\x02\x82" +
		"\x02\x84\x02\x86\x02\x88\x02\x8A\x02\x8C\x02\x8E\x02\x90\x02\x92\x02\x94" +
		"\x02\x96\x02\x98\x02\x9A\x02\x9C\x02\x9E\x02\xA0\x02\xA2\x02\xA4\x02\xA6" +
		"\x02\xA8\x02\xAA\x02\xAC\x02\xAE\x02\xB0\x02\xB2\x02\xB4\x02\xB6\x02\xB8" +
		"\x02\xBA\x02\xBC\x02\xBE\x02\xC0\x02\xC2\x02\xC4\x02\xC6\x02\xC8\x02\xCA" +
		"\x02\xCC\x02\xCE\x02\xD0\x02\x02\x14\x04\x02\n\n\x1B\x1B\x04\x02\x04\x04" +
		"\t\t\x04\x02##--\x05\x0222QQ\x7F\x80\x06\x02$$**<=KK\x07\x02%%++CCJJO" +
		"O\x04\x02hmuv\x03\x02\x80\x81\x04\x0222QQ\x04\x02~~\x82\x82\b\x02,,77" +
		">?HISSVV\x04\x02  11\x05\x02pprrww\x03\x02no\x04\x02!!EE\x04\x02[[ss\x04" +
		"\x02GGee\x03\x02pq\x02\u0426\x02\xD6\x03\x02\x02\x02\x04\xDF\x03\x02\x02" +
		"\x02\x06\xE1\x03\x02\x02\x02\b\xE4\x03\x02\x02\x02\n\xEA\x03\x02\x02\x02" +
		"\f\xEC\x03\x02\x02\x02\x0E\xEE\x03\x02\x02\x02\x10\xF6\x03\x02\x02\x02" +
		"\x12\u0102\x03\x02\x02\x02\x14\u0104\x03\x02\x02\x02\x16\u010D\x03\x02" +
		"\x02\x02\x18\u0111\x03\x02\x02\x02\x1A\u0114\x03\x02\x02\x02\x1C\u0116" +
		"\x03\x02\x02\x02\x1E\u0123\x03\x02\x02\x02 \u0127\x03\x02\x02\x02\"\u013B" +
		"\x03\x02\x02\x02$\u013D\x03\x02\x02\x02&\u014C\x03\x02\x02\x02(\u014E" +
		"\x03\x02\x02\x02*\u0151\x03\x02\x02\x02,\u0160\x03\x02\x02\x02.\u0162" +
		"\x03\x02\x02\x020\u0167\x03\x02\x02\x022\u0169\x03\x02\x02\x024\u016B" +
		"\x03\x02\x02\x026\u0178\x03\x02\x02\x028\u017C\x03\x02\x02\x02:\u018F" +
		"\x03\x02\x02\x02<\u0191\x03\x02\x02\x02>\u0193\x03\x02\x02\x02@\u019F" +
		"\x03\x02\x02\x02B\u01B0\x03\x02\x02\x02D\u01B2\x03\x02\x02\x02F\u01BF" +
		"\x03\x02\x02\x02H\u01C3\x03\x02\x02\x02J\u01D0\x03\x02\x02\x02L\u01DD" +
		"\x03\x02\x02\x02N\u01E1\x03\x02\x02\x02P\u01E3\x03\x02\x02\x02R\u01E5" +
		"\x03\x02\x02\x02T\u01E7\x03\x02\x02\x02V\u01FB\x03\x02\x02\x02X\u01FD" +
		"\x03\x02\x02\x02Z\u021B\x03\x02\x02\x02\\\u021D\x03\x02\x02\x02^\u0221" +
		"\x03\x02\x02\x02`\u0226\x03\x02\x02\x02b\u0228\x03\x02\x02\x02d\u0233" +
		"\x03\x02\x02\x02f\u0236\x03\x02\x02\x02h\u0239\x03\x02\x02\x02j\u0246" +
		"\x03\x02\x02\x02l\u0248\x03\x02\x02\x02n\u0259\x03\x02\x02\x02p\u025B" +
		"\x03\x02\x02\x02r\u025E\x03\x02\x02\x02t\u026B\x03\x02\x02\x02v\u026F" +
		"\x03\x02\x02\x02x\u0271\x03\x02\x02\x02z\u0274\x03\x02\x02\x02|\u028C" +
		"\x03\x02\x02\x02~\u028E\x03\x02\x02\x02\x80\u0291\x03\x02\x02\x02\x82" +
		"\u0294\x03\x02\x02\x02\x84\u0297\x03\x02\x02\x02\x86\u02A6\x03\x02\x02" +
		"\x02\x88\u02AB\x03\x02\x02\x02\x8A\u02B2\x03\x02\x02\x02\x8C\u02B4\x03" +
		"\x02\x02\x02\x8E\u02BF\x03\x02\x02\x02\x90\u02C1\x03\x02\x02\x02\x92\u02CB" +
		"\x03\x02\x02\x02\x94\u02D1\x03\x02\x02\x02\x96\u02D4\x03\x02\x02\x02\x98" +
		"\u02D6\x03\x02\x02\x02\x9A\u02D8\x03\x02\x02\x02\x9C\u02DA\x03\x02\x02" +
		"\x02\x9E\u02E3\x03\x02\x02\x02\xA0\u02EB\x03\x02\x02\x02\xA2\u02ED\x03" +
		"\x02\x02\x02\xA4\u02EF\x03\x02\x02\x02\xA6\u02F1\x03\x02\x02\x02\xA8\u02F3" +
		"\x03\x02\x02\x02\xAA\u0331\x03\x02\x02\x02\xAC\u0361\x03\x02\x02\x02\xAE" +
		"\u0366\x03\x02\x02\x02\xB0\u036E\x03\x02\x02\x02\xB2\u0375\x03\x02\x02" +
		"\x02\xB4\u0380\x03\x02\x02\x02\xB6\u038A\x03\x02\x02\x02\xB8\u039F\x03" +
		"\x02\x02\x02\xBA\u03A1\x03\x02\x02\x02\xBC\u03A9\x03\x02\x02\x02\xBE\u03AB" +
		"\x03\x02\x02\x02\xC0\u03AD\x03\x02\x02\x02\xC2\u03B0\x03\x02\x02\x02\xC4" +
		"\u03BA\x03\x02\x02\x02\xC6\u03C9\x03\x02\x02\x02\xC8\u03CB\x03\x02\x02" +
		"\x02\xCA\u03DC\x03\x02\x02\x02\xCC\u03DE\x03\x02\x02\x02\xCE\u03E0\x03" +
		"\x02\x02\x02\xD0\u03E2\x03\x02\x02\x02\xD2\xD5\x05\x04\x03\x02\xD3\xD5" +
		"\x07t\x02\x02\xD4\xD2\x03\x02\x02\x02\xD4\xD3\x03\x02\x02\x02\xD5\xD8" +
		"\x03\x02\x02\x02\xD6\xD4\x03\x02\x02\x02\xD6\xD7\x03\x02\x02\x02\xD7\xD9" +
		"\x03\x02\x02\x02\xD8\xD6\x03\x02\x02\x02\xD9\xDA\x07\x02\x02\x03\xDA\x03" +
		"\x03\x02\x02\x02\xDB\xE0\x05\x06\x04\x02\xDC\xE0\x05\x0E\b\x02\xDD\xE0" +
		"\x05\n\x06\x02\xDE\xE0\x05\x18\r\x02\xDF\xDB\x03\x02\x02\x02\xDF\xDC\x03" +
		"\x02\x02\x02\xDF\xDD\x03\x02\x02\x02\xDF\xDE\x03\x02\x02\x02\xE0\x05\x03" +
		"\x02\x02\x02\xE1\xE2\x05\b\x05\x02\xE2\xE3\x054\x1B\x02\xE3\x07\x03\x02" +
		"\x02\x02\xE4\xE5\t\x02\x02\x02\xE5\t\x03\x02\x02\x02\xE6\xE7\x07\x17\x02" +
		"\x02\xE7\xEB\x05\x1C\x0F\x02\xE8\xE9\x07\x17\x02\x02\xE9\xEB\x05\f\x07" +
		"\x02\xEA\xE6\x03\x02\x02\x02\xEA\xE8\x03\x02\x02\x02\xEB\v\x03\x02\x02" +
		"\x02\xEC\xED\x05\"\x12\x02\xED\r\x03\x02\x02\x02\xEE\xF2\x07\x1C\x02\x02" +
		"\xEF\xF0\x05\xCEh\x02\xF0\xF1\x079\x02\x02\xF1\xF3\x03\x02\x02\x02\xF2" +
		"\xEF\x03\x02\x02\x02\xF2\xF3\x03\x02\x02\x02\xF3\xF4\x03\x02\x02\x02\xF4" +
		"\xF5\x05\x10\t\x02\xF5\x0F\x03\x02\x02\x02\xF6\xF8\x07b\x02\x02\xF7\xF9" +
		"\x05\x12\n\x02\xF8\xF7\x03\x02\x02\x02\xF9\xFA\x03\x02\x02\x02\xFA\xF8" +
		"\x03\x02\x02\x02\xFA\xFB\x03\x02\x02\x02\xFB\xFC\x03\x02\x02\x02\xFC\xFD" +
		"\x07c\x02\x02\xFD\x11\x03\x02\x02\x02\xFE\xFF\x07\x06\x02\x02\xFF\u0103" +
		"\x05\xD0i\x02\u0100\u0101\x07\x1A\x02\x02\u0101\u0103\x05\x14\v\x02\u0102" +
		"\xFE\x03\x02\x02\x02\u0102\u0100\x03\x02\x02\x02\u0103\x13\x03\x02\x02" +
		"\x02\u0104\u0108\x07\x86\x02\x02\u0105\u0107\x05\x16\f\x02\u0106\u0105" +
		"\x03\x02\x02\x02\u0107\u010A\x03\x02\x02\x02\u0108\u0106\x03\x02\x02\x02" +
		"\u0108\u0109\x03\x02\x02\x02\u0109\u010B\x03\x02\x02\x02\u010A\u0108\x03" +
		"\x02\x02\x02\u010B\u010C\x07\x8B\x02\x02\u010C\x15\x03\x02\x02\x02\u010D" +
		"\u010E\x07\x8A\x02\x02\u010E\u010F\x05\"\x12\x02\u010F\u0110\x07\x87\x02" +
		"\x02\u0110\x17\x03\x02\x02\x02\u0111\u0112\x078\x02\x02\u0112\u0113\x05" +
		"\x1A\x0E\x02\u0113\x19\x03\x02\x02\x02\u0114\u0115\x07\x03\x02\x02\u0115" +
		"\x1B\x03\x02\x02\x02\u0116\u011D\x05\x1E\x10\x02\u0117\u0119\x07f\x02" +
		"\x02\u0118\u0117\x03\x02\x02\x02\u0118\u0119\x03\x02\x02\x02\u0119\u011A" +
		"\x03\x02\x02\x02\u011A\u011C\x05\x1E\x10\x02\u011B\u0118\x03\x02\x02\x02" +
		"\u011C\u011F\x03\x02\x02\x02\u011D\u011B\x03\x02\x02\x02\u011D\u011E\x03" +
		"\x02\x02\x02\u011E\u0121\x03\x02\x02\x02\u011F\u011D\x03\x02\x02\x02\u0120" +
		"\u0122\x07f\x02\x02\u0121\u0120\x03\x02\x02\x02\u0121\u0122\x03\x02\x02" +
		"\x02\u0122\x1D\x03\x02\x02\x02\u0123\u0124\x052\x1A\x02\u0124\u0125\x07" +
		"9\x02\x02\u0125\u0126\x05\"\x12\x02\u0126\x1F\x03\x02\x02\x02\u0127\u0128" +
		"\x07n\x02\x02\u0128!\x03\x02\x02\x02\u0129\u012A\x058\x1D\x02\u012A\u012B" +
		"\x07\\\x02\x02\u012B\u012C\x05$\x13\x02\u012C\u013C\x03\x02\x02\x02\u012D" +
		"\u012E\x07\\\x02\x02\u012E\u0133\x052\x1A\x02\u012F\u0131\x05 \x11\x02" +
		"\u0130\u012F\x03\x02\x02\x02\u0130\u0131\x03\x02\x02\x02\u0131\u0132\x03" +
		"\x02\x02\x02\u0132\u0134\x05,\x17\x02\u0133\u0130\x03\x02\x02\x02\u0133" +
		"\u0134\x03\x02\x02\x02\u0134\u0138\x03\x02\x02\x02\u0135\u0137\x05(\x15" +
		"\x02\u0136\u0135\x03\x02\x02\x02\u0137\u013A\x03\x02\x02\x02\u0138\u0136" +
		"\x03\x02\x02\x02\u0138\u0139\x03\x02\x02\x02\u0139\u013C\x03\x02\x02\x02" +
		"\u013A\u0138\x03\x02\x02\x02\u013B\u0129\x03\x02\x02\x02\u013B\u012D\x03" +
		"\x02\x02\x02\u013C#\x03\x02\x02\x02\u013D\u0141\x05&\x14\x02\u013E\u0140" +
		"\x05(\x15\x02\u013F\u013E\x03\x02\x02\x02\u0140\u0143\x03\x02\x02\x02" +
		"\u0141\u013F\x03\x02\x02\x02\u0141\u0142\x03\x02\x02\x02\u0142%\x03\x02" +
		"\x02\x02\u0143\u0141\x03\x02\x02\x02\u0144\u014D\x05,\x17\x02\u0145\u014A" +
		"\x050\x19\x02\u0146\u0148\x05 \x11\x02\u0147\u0146\x03\x02\x02\x02\u0147" +
		"\u0148\x03\x02\x02\x02\u0148\u0149\x03\x02\x02\x02\u0149\u014B\x05,\x17" +
		"\x02\u014A\u0147\x03\x02\x02\x02\u014A\u014B\x03\x02\x02\x02\u014B\u014D" +
		"\x03\x02\x02\x02\u014C\u0144\x03\x02\x02\x02\u014C\u0145\x03\x02\x02\x02" +
		"\u014D\'\x03\x02\x02\x02\u014E\u014F\x07\\\x02\x02\u014F\u0150\x05,\x17" +
		"\x02\u0150)\x03\x02\x02\x02\u0151\u0152\x07L\x02\x02\u0152\u0153\x07^" +
		"\x02\x02\u0153\u0154\x05\xA2R\x02\u0154\u0155\x07_\x02\x02\u0155+\x03" +
		"\x02\x02\x02\u0156\u0161\x05.\x18\x02\u0157\u015C\x07b\x02\x02\u0158\u015B" +
		"\x05n8\x02\u0159\u015B\x07t\x02\x02\u015A\u0158\x03\x02\x02\x02\u015A" +
		"\u0159\x03\x02\x02\x02\u015B\u015E\x03\x02\x02\x02\u015C\u015A\x03\x02" +
		"\x02\x02\u015C\u015D\x03\x02\x02\x02\u015D\u015F\x03\x02\x02\x02\u015E" +
		"\u015C\x03\x02\x02\x02\u015F\u0161\x07c\x02\x02\u0160\u0156\x03\x02\x02" +
		"\x02\u0160\u0157\x03\x02\x02\x02\u0161-\x03\x02\x02\x02\u0162\u0163\x07" +
		"b\x02\x02\u0163\u0164\x07G\x02\x02\u0164\u0165\x05\xAAV\x02\u0165\u0166" +
		"\x07c\x02\x02\u0166/\x03\x02\x02\x02\u0167\u0168\x05\xA4S\x02\u01681\x03" +
		"\x02\x02\x02\u0169\u016A\x05\xA4S\x02\u016A3\x03\x02\x02\x02\u016B\u0172" +
		"\x056\x1C\x02\u016C\u016E\x07f\x02\x02\u016D\u016C\x03\x02\x02\x02\u016D" +
		"\u016E\x03\x02\x02\x02\u016E\u016F\x03\x02\x02\x02\u016F\u0171\x056\x1C" +
		"\x02\u0170\u016D\x03\x02\x02\x02\u0171\u0174\x03\x02\x02\x02\u0172\u0170" +
		"\x03\x02\x02\x02\u0172\u0173\x03\x02\x02\x02\u0173\u0176\x03\x02\x02\x02" +
		"\u0174\u0172\x03\x02\x02\x02\u0175\u0177\x07f\x02\x02\u0176\u0175\x03" +
		"\x02\x02\x02\u0176\u0177\x03\x02\x02\x02\u01775\x03\x02\x02\x02\u0178" +
		"\u0179\x05<\x1F\x02\u0179\u017A\x079\x02\x02\u017A\u017B\x058\x1D\x02" +
		"\u017B7\x03\x02\x02\x02\u017C\u0181\x05:\x1E\x02\u017D\u017F\x05 \x11" +
		"\x02\u017E\u017D\x03\x02\x02\x02\u017E\u017F\x03\x02\x02\x02\u017F\u0180" +
		"\x03\x02\x02\x02\u0180\u0182\x05@!\x02\u0181\u017E\x03\x02\x02\x02\u0181" +
		"\u0182\x03\x02\x02\x02\u01829\x03\x02\x02\x02\u0183\u0190\x05> \x02\u0184" +
		"\u0190\x05*\x16\x02\u0185\u0186\x074\x02\x02\u0186\u0187\x07^\x02\x02" +
		"\u0187\u0188\x05\"\x12\x02\u0188\u0189\x07_\x02\x02\u0189\u0190\x03\x02" +
		"\x02\x02\u018A\u018B\x075\x02\x02\u018B\u018C\x07^\x02\x02\u018C\u018D" +
		"\x05\xCCg\x02\u018D\u018E\x07_\x02\x02\u018E\u0190\x03\x02\x02\x02\u018F" +
		"\u0183\x03\x02\x02\x02\u018F\u0184\x03\x02\x02\x02\u018F\u0185\x03\x02" +
		"\x02\x02\u018F\u018A\x03\x02\x02\x02\u0190;\x03\x02\x02\x02\u0191\u0192" +
		"\x05\xA4S\x02\u0192=\x03\x02\x02\x02\u0193\u0194\x05\xA4S\x02\u0194?\x03" +
		"\x02\x02\x02\u0195\u019A\x07b\x02\x02\u0196\u0199\x05B\"\x02\u0197\u0199" +
		"\x07t\x02\x02\u0198\u0196\x03\x02\x02\x02\u0198\u0197\x03\x02\x02\x02" +
		"\u0199\u019C\x03\x02\x02\x02\u019A\u0198\x03\x02\x02\x02\u019A\u019B\x03" +
		"\x02\x02\x02\u019B\u019D\x03\x02\x02\x02\u019C\u019A\x03\x02\x02\x02\u019D" +
		"\u01A0\x07c\x02\x02\u019E\u01A0\x05.\x18\x02\u019F\u0195\x03\x02\x02\x02" +
		"\u019F\u019E\x03\x02\x02\x02\u01A0A\x03\x02\x02\x02\u01A1\u01A2\x07\b" +
		"\x02\x02\u01A2\u01B1\x05H%\x02\u01A3\u01A4\x07\x12\x02\x02\u01A4\u01B1" +
		"\x05J&\x02\u01A5\u01B1\x05T+\x02\u01A6\u01B1\x05V,\x02\u01A7\u01B1\x05" +
		"d3\x02\u01A8\u01A9\x07\x15\x02\x02\u01A9\u01B1\x05\xBE`\x02\u01AA\u01AB" +
		"\x07\x18\x02\x02\u01AB\u01B1\x05D#\x02\u01AC\u01AD\t\x03\x02\x02\u01AD" +
		"\u01B1\x05\xB4[\x02\u01AE\u01AF\x07\x17\x02\x02\u01AF\u01B1\x05h5\x02" +
		"\u01B0\u01A1\x03\x02\x02\x02\u01B0\u01A3\x03\x02\x02\x02\u01B0\u01A5\x03" +
		"\x02\x02\x02\u01B0\u01A6\x03\x02\x02\x02\u01B0\u01A7\x03\x02\x02\x02\u01B0" +
		"\u01A8\x03\x02\x02\x02\u01B0\u01AA\x03\x02\x02\x02\u01B0\u01AC\x03\x02" +
		"\x02\x02\u01B0\u01AE\x03\x02\x02\x02\u01B1C\x03\x02\x02\x02\u01B2\u01B9" +
		"\x05F$\x02\u01B3\u01B5\x07f\x02\x02\u01B4\u01B3\x03\x02\x02\x02\u01B4" +
		"\u01B5\x03\x02\x02\x02\u01B5\u01B6\x03\x02\x02\x02\u01B6\u01B8\x05F$\x02" +
		"\u01B7\u01B4\x03\x02\x02\x02\u01B8\u01BB\x03\x02\x02\x02\u01B9\u01B7\x03" +
		"\x02\x02\x02\u01B9\u01BA\x03\x02\x02\x02\u01BA\u01BD\x03\x02\x02\x02\u01BB" +
		"\u01B9\x03\x02\x02\x02\u01BC\u01BE\x07f\x02\x02\u01BD\u01BC\x03\x02\x02" +
		"\x02\u01BD\u01BE\x03\x02\x02\x02\u01BEE\x03\x02\x02\x02\u01BF\u01C0\x05" +
		"\xBE`\x02\u01C0\u01C1\x079\x02\x02\u01C1\u01C2\x05\xBE`\x02\u01C2G\x03" +
		"\x02\x02\x02\u01C3\u01CA\x05t;\x02\u01C4\u01C6\x07f\x02\x02\u01C5\u01C4" +
		"\x03\x02\x02\x02\u01C5\u01C6\x03\x02\x02\x02\u01C6\u01C7\x03\x02\x02\x02" +
		"\u01C7\u01C9\x05t;\x02\u01C8\u01C5\x03\x02\x02\x02\u01C9\u01CC\x03\x02" +
		"\x02\x02\u01CA\u01C8\x03\x02\x02\x02\u01CA\u01CB\x03\x02\x02\x02\u01CB" +
		"\u01CE\x03\x02\x02\x02\u01CC\u01CA\x03\x02\x02\x02\u01CD\u01CF\x07f\x02" +
		"\x02\u01CE\u01CD\x03\x02\x02\x02\u01CE\u01CF\x03\x02\x02\x02\u01CFI\x03" +
		"\x02\x02\x02\u01D0\u01D7\x05R*\x02\u01D1\u01D3\x07f\x02\x02\u01D2\u01D1" +
		"\x03\x02\x02\x02\u01D2\u01D3\x03\x02\x02\x02\u01D3\u01D4\x03\x02\x02\x02" +
		"\u01D4\u01D6\x05R*\x02\u01D5\u01D2\x03\x02\x02\x02\u01D6\u01D9\x03\x02" +
		"\x02\x02\u01D7\u01D5\x03\x02\x02\x02\u01D7\u01D8\x03\x02\x02\x02\u01D8" +
		"\u01DB\x03\x02\x02\x02\u01D9\u01D7\x03\x02\x02\x02\u01DA\u01DC\x07f\x02" +
		"\x02\u01DB";
	private static readonly _serializedATNSegment1: string =
		"\u01DA\x03\x02\x02\x02\u01DB\u01DC\x03\x02\x02\x02\u01DCK\x03\x02\x02" +
		"\x02\u01DD\u01DE\x05N(\x02\u01DE\u01DF\x079\x02\x02\u01DF\u01E0\x05\xAA" +
		"V\x02\u01E0M\x03\x02\x02\x02\u01E1\u01E2\x05\xA4S\x02\u01E2O\x03\x02\x02" +
		"\x02\u01E3\u01E4\x05\xA4S\x02\u01E4Q\x03\x02\x02\x02\u01E5\u01E6\x05L" +
		"\'\x02\u01E6S\x03\x02\x02\x02\u01E7\u01E8\x07\x07\x02\x02\u01E8\u01EF" +
		"\x05L\'\x02\u01E9\u01EB\x07f\x02\x02\u01EA\u01E9\x03\x02\x02\x02\u01EA" +
		"\u01EB\x03\x02\x02\x02\u01EB\u01EC\x03\x02\x02\x02\u01EC\u01EE\x05L\'" +
		"\x02\u01ED\u01EA\x03\x02\x02\x02\u01EE\u01F1\x03\x02\x02\x02\u01EF\u01ED" +
		"\x03\x02\x02\x02\u01EF\u01F0\x03\x02\x02\x02\u01F0\u01F3\x03\x02\x02\x02" +
		"\u01F1\u01EF\x03\x02\x02\x02\u01F2\u01F4\x07f\x02\x02\u01F3\u01F2\x03" +
		"\x02\x02\x02\u01F3\u01F4\x03\x02\x02\x02\u01F4U\x03\x02\x02\x02\u01F5" +
		"\u01F6\x07\x0F\x02\x02\u01F6\u01FC\x05X-\x02\u01F7\u01F8\x07\x10\x02\x02" +
		"\u01F8\u01FC\x05X-\x02\u01F9\u01FA\x07\x0E\x02\x02\u01FA\u01FC\x05X-\x02" +
		"\u01FB\u01F5\x03\x02\x02\x02\u01FB\u01F7\x03\x02\x02\x02\u01FB\u01F9\x03" +
		"\x02\x02\x02\u01FCW\x03\x02\x02\x02\u01FD\u0204\x05Z.\x02\u01FE\u0200" +
		"\x07f\x02\x02\u01FF\u01FE\x03\x02\x02\x02\u01FF\u0200\x03\x02\x02\x02" +
		"\u0200\u0201\x03\x02\x02\x02\u0201\u0203\x05Z.\x02\u0202\u01FF\x03\x02" +
		"\x02\x02\u0203\u0206\x03\x02\x02\x02\u0204\u0202\x03\x02\x02\x02\u0204" +
		"\u0205\x03\x02\x02\x02\u0205\u0208\x03\x02\x02\x02\u0206\u0204\x03\x02" +
		"\x02\x02\u0207\u0209\x07f\x02\x02\u0208\u0207\x03\x02\x02\x02\u0208\u0209" +
		"\x03\x02\x02\x02\u0209Y\x03\x02\x02\x02\u020A\u020D\x05P)\x02\u020B\u020C" +
		"\x079\x02\x02\u020C\u020E\x058\x1D\x02\u020D\u020B\x03\x02\x02\x02\u020D" +
		"\u020E\x03\x02\x02\x02\u020E\u020F\x03\x02\x02\x02\u020F\u0210\x07U\x02" +
		"\x02\u0210\u0211\x05\xAAV\x02\u0211\u021C\x03\x02\x02\x02\u0212\u0215" +
		"\x05P)\x02\u0213\u0214\x079\x02\x02\u0214\u0216\x058\x1D\x02\u0215\u0213" +
		"\x03\x02\x02\x02\u0215\u0216\x03\x02\x02\x02\u0216\u0219\x03\x02\x02\x02" +
		"\u0217\u0218\x07D\x02\x02\u0218\u021A\x05\\/\x02\u0219\u0217\x03\x02\x02" +
		"\x02\u0219\u021A\x03\x02\x02\x02\u021A\u021C\x03\x02\x02\x02\u021B\u020A" +
		"\x03\x02\x02\x02\u021B\u0212\x03\x02\x02\x02\u021C[\x03\x02\x02\x02\u021D" +
		"\u021E\x05\xAAV\x02\u021E]\x03\x02\x02\x02\u021F\u0222\x05d3\x02\u0220" +
		"\u0222\x05f4\x02\u0221\u021F\x03\x02\x02\x02\u0221\u0220\x03\x02\x02\x02" +
		"\u0222_\x03\x02\x02\x02\u0223\u0224\x07G\x02\x02\u0224\u0227\x05\xAAV" +
		"\x02\u0225\u0227\x05d3\x02\u0226\u0223\x03\x02\x02\x02\u0226\u0225\x03" +
		"\x02\x02\x02\u0227a\x03\x02\x02\x02\u0228\u022D\x05\xAAV\x02\u0229\u022A" +
		"\x07f\x02\x02\u022A\u022C\x05\xAAV\x02\u022B\u0229\x03\x02\x02\x02\u022C" +
		"\u022F\x03\x02\x02\x02\u022D\u022B\x03\x02\x02\x02\u022D\u022E\x03\x02" +
		"\x02\x02\u022E\u0231\x03\x02\x02\x02\u022F\u022D\x03\x02\x02\x02\u0230" +
		"\u0232\x07f\x02\x02\u0231\u0230\x03\x02\x02\x02\u0231\u0232\x03\x02\x02" +
		"\x02\u0232c\x03\x02\x02\x02\u0233\u0234\x07\x1F\x02\x02\u0234\u0235\x05" +
		"b2\x02\u0235e\x03\x02\x02\x02\u0236\u0237\x07\f\x02\x02\u0237\u0238\x05" +
		"b2\x02\u0238g\x03\x02\x02\x02\u0239\u0240\x05l7\x02\u023A\u023C\x07f\x02" +
		"\x02\u023B\u023A\x03\x02\x02\x02\u023B\u023C\x03\x02\x02\x02\u023C\u023D" +
		"\x03\x02\x02\x02\u023D\u023F\x05l7\x02\u023E\u023B\x03\x02\x02\x02\u023F" +
		"\u0242\x03\x02\x02\x02\u0240\u023E\x03\x02\x02\x02\u0240\u0241\x03\x02" +
		"\x02\x02\u0241\u0244\x03\x02\x02\x02\u0242\u0240\x03\x02\x02\x02\u0243" +
		"\u0245\x07f\x02\x02\u0244\u0243\x03\x02\x02\x02\u0244\u0245\x03\x02\x02" +
		"\x02\u0245i\x03\x02\x02\x02\u0246\u0247\x05\xA4S\x02\u0247k\x03\x02\x02" +
		"\x02\u0248\u0249\x05j6\x02\u0249\u024A\x079\x02\x02\u024A\u024B\x05$\x13" +
		"\x02\u024Bm\x03\x02\x02\x02\u024C\u025A\x05p9\x02\u024D\u025A\x05T+\x02" +
		"\u024E\u025A\x05V,\x02\u024F\u025A\x05\x80A\x02\u0250\u025A\x05\x92J\x02" +
		"\u0251\u025A\x05~@\x02\u0252\u025A\x05\x8CG\x02\u0253\u025A\x05\x88E\x02" +
		"\u0254\u025A\x05\x82B\x02\u0255\u025A\x05d3\x02\u0256\u025A\x05f4\x02" +
		"\u0257\u025A\x05x=\x02\u0258\u025A\x05\x94K\x02\u0259\u024C\x03\x02\x02" +
		"\x02\u0259\u024D\x03\x02\x02\x02\u0259\u024E\x03\x02\x02\x02\u0259\u024F" +
		"\x03\x02\x02\x02\u0259\u0250\x03\x02\x02\x02\u0259\u0251\x03\x02\x02\x02" +
		"\u0259\u0252\x03\x02\x02\x02\u0259\u0253\x03\x02\x02\x02\u0259\u0254\x03" +
		"\x02\x02\x02\u0259\u0255\x03\x02\x02\x02\u0259\u0256\x03\x02\x02\x02\u0259" +
		"\u0257\x03\x02\x02\x02\u0259\u0258\x03\x02\x02\x02\u025Ao\x03\x02\x02" +
		"\x02\u025B\u025C\x07\v\x02\x02\u025C\u025D\x05r:\x02\u025Dq\x03\x02\x02" +
		"\x02\u025E\u0265\x05v<\x02\u025F\u0261\x07f\x02\x02\u0260\u025F\x03\x02" +
		"\x02\x02\u0260\u0261\x03\x02\x02\x02\u0261\u0262\x03\x02\x02\x02\u0262" +
		"\u0264\x05v<\x02\u0263\u0260\x03\x02\x02\x02\u0264\u0267\x03\x02\x02\x02" +
		"\u0265\u0263\x03\x02\x02\x02\u0265\u0266\x03\x02\x02\x02\u0266\u0269\x03" +
		"\x02\x02\x02\u0267\u0265\x03\x02\x02\x02\u0268\u026A\x07f\x02\x02\u0269" +
		"\u0268\x03\x02\x02\x02\u0269\u026A\x03\x02\x02\x02\u026As\x03\x02\x02" +
		"\x02\u026B\u026C\x05L\'\x02\u026Cu\x03\x02\x02\x02\u026D\u0270\x05\xBA" +
		"^\x02\u026E\u0270\x05t;\x02\u026F\u026D\x03\x02\x02\x02\u026F\u026E\x03" +
		"\x02\x02\x02\u0270w\x03\x02\x02\x02\u0271\u0272\x07\x13\x02\x02\u0272" +
		"\u0273\x05z>\x02\u0273y\x03\x02\x02\x02\u0274\u027B\x05|?\x02\u0275\u0277" +
		"\x07f\x02\x02\u0276\u0275\x03\x02\x02\x02\u0276\u0277\x03\x02\x02\x02" +
		"\u0277\u0278\x03\x02\x02\x02\u0278\u027A\x05|?\x02\u0279\u0276\x03\x02" +
		"\x02\x02\u027A\u027D\x03\x02\x02\x02\u027B\u0279\x03\x02\x02\x02\u027B" +
		"\u027C\x03\x02\x02\x02\u027C\u027F\x03\x02\x02\x02\u027D\u027B\x03\x02" +
		"\x02\x02\u027E\u0280\x07f\x02\x02\u027F\u027E\x03\x02\x02\x02\u027F\u0280" +
		"\x03\x02\x02\x02\u0280{\x03\x02\x02\x02\u0281\u0286\x052\x1A\x02\u0282" +
		"\u0284\x05 \x11\x02\u0283\u0282\x03\x02\x02\x02\u0283\u0284\x03\x02\x02" +
		"\x02\u0284\u0285\x03\x02\x02\x02\u0285\u0287\x05,\x17\x02\u0286\u0283" +
		"\x03\x02\x02\x02\u0286\u0287\x03\x02\x02\x02\u0287\u028D\x03\x02\x02\x02" +
		"\u0288\u0289\x052\x1A\x02\u0289\u028A\x079\x02\x02\u028A\u028B\x05$\x13" +
		"\x02\u028B\u028D\x03\x02\x02\x02\u028C\u0281\x03\x02\x02\x02\u028C\u0288" +
		"\x03\x02\x02\x02\u028D}\x03\x02\x02\x02\u028E\u028F\x07\x05\x02\x02\u028F" +
		"\u0290\x05r:\x02\u0290\x7F\x03\x02\x02\x02\u0291\u0292\x07\x16\x02\x02" +
		"\u0292\u0293\x05\xB6\\\x02\u0293\x81\x03\x02\x02\x02\u0294\u0295\x07\x14" +
		"\x02\x02\u0295\u0296\x05\x84C\x02\u0296\x83\x03\x02\x02\x02\u0297\u029E" +
		"\x05\x86D\x02\u0298\u029A\x07f\x02\x02\u0299\u0298\x03\x02\x02\x02\u0299" +
		"\u029A\x03\x02\x02\x02\u029A\u029B\x03\x02\x02\x02\u029B\u029D\x05\x86" +
		"D\x02\u029C\u0299\x03\x02\x02\x02\u029D\u02A0\x03\x02\x02\x02\u029E\u029C" +
		"\x03\x02\x02\x02\u029E\u029F\x03\x02\x02\x02\u029F\u02A2\x03\x02\x02\x02" +
		"\u02A0\u029E\x03\x02\x02\x02\u02A1\u02A3\x07f\x02\x02\u02A2\u02A1\x03" +
		"\x02\x02\x02\u02A2\u02A3\x03\x02\x02\x02\u02A3\x85\x03\x02\x02\x02\u02A4" +
		"\u02A7\x07\x80\x02\x02\u02A5\u02A7\x05\xBE`\x02\u02A6\u02A4\x03\x02\x02" +
		"\x02\u02A6\u02A5\x03\x02\x02\x02\u02A7\u02A9\x03\x02\x02\x02\u02A8\u02AA" +
		"\t\x04\x02\x02\u02A9\u02A8\x03\x02\x02\x02\u02A9\u02AA\x03\x02\x02\x02" +
		"\u02AA\x87\x03\x02\x02\x02\u02AB\u02AC\x07\x11\x02\x02\u02AC\u02AD\x07" +
		"\x80\x02\x02\u02AD\x89\x03\x02\x02\x02\u02AE\u02AF\x07&\x02\x02\u02AF" +
		"\u02B3\x05\xBE`\x02\u02B0\u02B1\x07&\x02\x02\u02B1\u02B3\x05\xAAV\x02" +
		"\u02B2\u02AE\x03\x02\x02\x02\u02B2\u02B0\x03\x02\x02\x02\u02B3\x8B\x03" +
		"\x02\x02\x02\u02B4\u02B5\x07\x1E\x02\x02\u02B5\u02B7\x07\x80\x02\x02\u02B6" +
		"\u02B8\x05\x8AF\x02\u02B7\u02B6\x03\x02\x02\x02\u02B7\u02B8\x03\x02\x02" +
		"\x02\u02B8\x8D\x03\x02\x02\x02\u02B9\u02BC\x05\xBA^\x02\u02BA\u02BB\x07" +
		"g\x02\x02\u02BB\u02BD\x07p\x02\x02\u02BC\u02BA\x03\x02\x02\x02\u02BC\u02BD" +
		"\x03\x02\x02\x02\u02BD\u02C0\x03\x02\x02\x02\u02BE\u02C0\x07p\x02\x02" +
		"\u02BF\u02B9\x03\x02\x02\x02\u02BF\u02BE\x03\x02\x02\x02\u02C0\x8F\x03" +
		"\x02\x02\x02\u02C1\u02C8\x05\x8EH\x02\u02C2\u02C4\x07f\x02\x02\u02C3\u02C2" +
		"\x03\x02\x02\x02\u02C3\u02C4\x03\x02\x02\x02\u02C4\u02C5\x03\x02\x02\x02" +
		"\u02C5\u02C7\x05\x8EH\x02\u02C6\u02C3\x03\x02\x02\x02\u02C7\u02CA\x03" +
		"\x02\x02\x02\u02C8\u02C6\x03\x02\x02\x02\u02C8\u02C9\x03\x02\x02\x02\u02C9" +
		"\x91\x03\x02\x02\x02\u02CA\u02C8\x03\x02\x02\x02\u02CB\u02CC\x07\r\x02" +
		"\x02\u02CC\u02CF\x05\x90I\x02\u02CD\u02CE\x07&\x02\x02\u02CE\u02D0\x05" +
		"\xBE`\x02\u02CF\u02CD\x03\x02\x02\x02\u02CF\u02D0\x03\x02\x02\x02\u02D0" +
		"\x93\x03\x02\x02\x02\u02D1\u02D2\x07\x19\x02\x02\u02D2\u02D3\x05\x96L" +
		"\x02\u02D3\x95\x03\x02\x02\x02\u02D4\u02D5\t\x05\x02\x02\u02D5\x97\x03" +
		"\x02\x02\x02\u02D6\u02D7\t\x06\x02\x02\u02D7\x99\x03\x02\x02\x02\u02D8" +
		"\u02D9\t\x07\x02\x02\u02D9\x9B\x03\x02\x02\x02\u02DA\u02DB\t\b\x02\x02" +
		"\u02DB\x9D\x03\x02\x02\x02\u02DC\u02E4\x07Z\x02\x02\u02DD\u02E4\t\t\x02" +
		"\x02\u02DE\u02E4\x05\xA0Q\x02\u02DF\u02E4\x07B\x02\x02\u02E0\u02E4\t\n" +
		"\x02\x02\u02E1\u02E4\x07Y\x02\x02\u02E2\u02E4\x07A\x02\x02\u02E3\u02DC" +
		"\x03\x02\x02\x02\u02E3\u02DD\x03\x02\x02\x02\u02E3\u02DE\x03\x02\x02\x02" +
		"\u02E3\u02DF\x03\x02\x02\x02\u02E3\u02E0\x03\x02\x02\x02\u02E3\u02E1\x03" +
		"\x02\x02\x02\u02E3\u02E2\x03\x02\x02\x02\u02E4\x9F\x03\x02\x02\x02\u02E5" +
		"\u02EC\x07x\x02\x02\u02E6\u02EC\x07y\x02\x02\u02E7\u02EC\x07|\x02\x02" +
		"\u02E8\u02EC\x07{\x02\x02\u02E9\u02EC\x07z\x02\x02\u02EA\u02EC\x07}\x02" +
		"\x02\u02EB\u02E5\x03\x02\x02\x02\u02EB\u02E6\x03\x02\x02\x02\u02EB\u02E7" +
		"\x03\x02\x02\x02\u02EB\u02E8\x03\x02\x02\x02\u02EB\u02E9\x03\x02\x02\x02" +
		"\u02EB\u02EA\x03\x02\x02\x02\u02EC\xA1\x03\x02\x02\x02\u02ED\u02EE\x07" +
		"Z\x02\x02\u02EE\xA3\x03\x02\x02\x02\u02EF\u02F0\t\v\x02\x02\u02F0\xA5" +
		"\x03\x02\x02\x02\u02F1\u02F2\t\f\x02\x02\u02F2\xA7\x03\x02\x02\x02\u02F3" +
		"\u02F4\t\r\x02\x02\u02F4\xA9\x03\x02\x02\x02\u02F5\u02F6\bV\x01\x02\u02F6" +
		"\u0332\x05\xBA^\x02\u02F7\u0332\x05\x9EP\x02\u02F8\u02F9\x07o\x02\x02" +
		"\u02F9\u0332\x05\xAAV\x16\u02FA\u02FB\x07@\x02\x02\u02FB\u0332\x05\xAA" +
		"V\v\u02FC\u02FD\x07(\x02\x02\u02FD\u02FE\x07^\x02\x02\u02FE\u02FF\x05" +
		"\xAAV\x02\u02FF\u0300\x07\"\x02\x02\u0300\u0301\x05\x9AN\x02\u0301\u0302" +
		"\x07_\x02\x02\u0302\u0332\x03\x02\x02\x02\u0303\u0304\x07*\x02\x02\u0304" +
		"\u0305\x07^\x02\x02\u0305\u0306\x07.\x02\x02\u0306\u0307\x05\xAAV\x02" +
		"\u0307\u0308\x07_\x02\x02\u0308\u0332\x03\x02\x02\x02\u0309\u030A\x05" +
		"\xBA^\x02\u030A\u030B\x07g\x02\x02\u030B\u030D\x03\x02\x02\x02\u030C\u0309" +
		"\x03\x02\x02\x02\u030C\u030D\x03\x02\x02\x02\u030D\u030E\x03\x02\x02\x02" +
		"\u030E\u030F\x05\x98M\x02\u030F\u0312\x07^\x02\x02\u0310\u0313\x05\xAA" +
		"V\x02\u0311\u0313\x07p\x02\x02\u0312\u0310\x03\x02\x02\x02\u0312\u0311" +
		"\x03\x02\x02\x02\u0312\u0313\x03\x02\x02\x02\u0313\u0314\x03\x02\x02\x02" +
		"\u0314\u0315\x07_\x02\x02\u0315\u0332\x03\x02\x02\x02\u0316\u0317\x07" +
		"^\x02\x02\u0317\u0318\x05\xACW\x02\u0318\u0319\x07_\x02\x02\u0319\u0332" +
		"\x03\x02\x02\x02\u031A\u031D\x05\xA4S\x02\u031B\u031D\x05\xA6T\x02\u031C" +
		"\u031A\x03\x02\x02\x02\u031C\u031B\x03\x02\x02\x02\u031D\u031E\x03\x02" +
		"\x02\x02\u031E\u0320\x07^\x02\x02\u031F\u0321\x05\xB2Z\x02\u0320\u031F" +
		"\x03\x02\x02\x02\u0320\u0321\x03\x02\x02\x02\u0321\u0322\x03\x02\x02\x02" +
		"\u0322\u0323\x07_\x02\x02\u0323\u0332\x03\x02\x02\x02\u0324\u0332\x05" +
		"\xAEX\x02\u0325\u0326\x05\xA8U\x02\u0326\u0327\x07^\x02\x02\u0327\u032C" +
		"\x05\xAAV\x02\u0328\u0329\x07f\x02\x02\u0329\u032B\x05\xBE`\x02\u032A" +
		"\u0328\x03\x02\x02\x02\u032B\u032E\x03\x02\x02\x02\u032C\u032A\x03\x02" +
		"\x02\x02\u032C\u032D\x03\x02\x02\x02\u032D\u032F\x03\x02\x02\x02\u032E" +
		"\u032C\x03\x02\x02\x02\u032F\u0330\x07_\x02\x02\u0330\u0332\x03\x02\x02" +
		"\x02\u0331\u02F5\x03\x02\x02\x02\u0331\u02F7\x03\x02\x02\x02\u0331\u02F8" +
		"\x03\x02\x02\x02\u0331\u02FA\x03\x02\x02\x02\u0331\u02FC\x03\x02\x02\x02" +
		"\u0331\u0303\x03\x02\x02\x02\u0331\u030C\x03\x02\x02\x02\u0331\u0316\x03" +
		"\x02\x02\x02\u0331\u031C\x03\x02\x02\x02\u0331\u0324\x03\x02\x02\x02\u0331" +
		"\u0325\x03\x02\x02\x02\u0332\u035D\x03\x02\x02\x02\u0333\u0334\f\x12\x02" +
		"\x02\u0334\u0335\t\x0E\x02\x02\u0335\u035C\x05\xAAV\x13\u0336\u0337\f" +
		"\x11\x02\x02\u0337\u0338\t\x0F\x02\x02\u0338\u035C\x05\xAAV\x12\u0339" +
		"\u033A\f\x10\x02\x02\u033A\u033B\x07P\x02\x02\u033B\u035C\x05\xAAV\x11" +
		"\u033C\u033D\f\r\x02\x02\u033D\u033E\x05\x9CO\x02\u033E\u033F\x05\xAA" +
		"V\x0E\u033F\u035C\x03\x02\x02\x02\u0340\u0341\f\n\x02\x02\u0341\u0342" +
		"\t\x10\x02\x02\u0342\u035C\x05\xAAV\v\u0343\u0344\f\x18\x02\x02\u0344" +
		"\u0345\x07b\x02\x02\u0345\u0346\x05`1\x02\u0346\u0347\x07c\x02\x02\u0347" +
		"\u035C\x03\x02\x02\x02\u0348\u0349\f\x15\x02\x02\u0349\u035C\x05\xA6T" +
		"\x02\u034A\u034B\f\x14\x02\x02\u034B\u034C\x07g\x02\x02\u034C\u035C\x05" +
		"\xA6T\x02\u034D\u034E\f\x13\x02\x02\u034E\u034F\x07d\x02\x02\u034F\u035C" +
		"\x05\x9AN\x02\u0350\u0351\f\x0F\x02\x02\u0351\u0352\x073\x02\x02\u0352" +
		"\u0353\x05\xAAV\x02\u0353\u0354\x05\xA6T\x02\u0354\u035C\x03\x02\x02\x02" +
		"\u0355\u0356\f\x0E\x02\x02\u0356\u0357\t\x11\x02\x02\u0357\u035C\x05\xAC" +
		"W\x02\u0358\u0359\f\f\x02\x02\u0359\u035A\t\x12\x02\x02\u035A\u035C\x05" +
		"\xACW\x02\u035B\u0333\x03\x02\x02\x02\u035B\u0336\x03\x02\x02\x02\u035B" +
		"\u0339\x03\x02\x02\x02\u035B\u033C\x03\x02\x02\x02\u035B\u0340\x03\x02" +
		"\x02\x02\u035B\u0343\x03\x02\x02\x02\u035B\u0348\x03\x02\x02\x02\u035B" +
		"\u034A\x03\x02\x02\x02\u035B\u034D\x03\x02\x02\x02\u035B\u0350\x03\x02" +
		"\x02\x02\u035B\u0355\x03\x02\x02\x02\u035B\u0358\x03\x02\x02\x02\u035C" +
		"\u035F\x03\x02\x02\x02\u035D\u035B\x03\x02\x02\x02\u035D\u035E\x03\x02" +
		"\x02\x02\u035E\xAB\x03\x02\x02\x02\u035F\u035D\x03\x02\x02\x02\u0360\u0362" +
		"\x05\x9CO\x02\u0361\u0360\x03\x02\x02\x02\u0361\u0362\x03\x02\x02\x02" +
		"\u0362\u0363\x03\x02\x02\x02\u0363\u0364\x05\xAAV\x02\u0364\xAD\x03\x02" +
		"\x02\x02\u0365\u0367\x05\xB0Y\x02\u0366\u0365\x03\x02\x02\x02\u0367\u0368" +
		"\x03\x02\x02\x02\u0368\u0366\x03\x02\x02\x02\u0368\u0369\x03\x02\x02\x02" +
		"\u0369\u036C\x03\x02\x02\x02\u036A\u036B\x07/\x02\x02\u036B\u036D\x05" +
		"\xAAV\x02\u036C\u036A\x03\x02\x02\x02\u036C\u036D\x03\x02\x02\x02\u036D" +
		"\xAF\x03\x02\x02\x02\u036E\u0370\x07F\x02\x02\u036F\u0371\x05\xAAV\x02" +
		"\u0370\u036F\x03\x02\x02\x02\u0370\u0371\x03\x02\x02\x02\u0371\u0372\x03" +
		"\x02\x02\x02\u0372\u0373\x07T\x02\x02\u0373\u0374\x05\xACW\x02\u0374\xB1" +
		"\x03\x02\x02\x02\u0375\u037A\x05\xAAV\x02\u0376\u0377\x07f\x02\x02\u0377" +
		"\u0379\x05\xAAV\x02\u0378\u0376\x03\x02\x02\x02\u0379\u037C\x03\x02\x02" +
		"\x02\u037A\u0378\x03\x02\x02\x02\u037A\u037B\x03\x02\x02\x02\u037B\u037E" +
		"\x03\x02\x02\x02\u037C\u037A\x03\x02\x02\x02\u037D\u037F\x07f\x02\x02" +
		"\u037E\u037D\x03\x02\x02\x02\u037E\u037F\x03\x02\x02\x02\u037F\xB3\x03" +
		"\x02\x02\x02\u0380\u0387\x05\xBE`\x02\u0381\u0383\x07f\x02\x02\u0382\u0381" +
		"\x03\x02\x02\x02\u0382\u0383\x03\x02\x02\x02\u0383\u0384\x03\x02\x02\x02" +
		"\u0384\u0386\x05\xBE`\x02\u0385\u0382\x03\x02\x02\x02\u0386\u0389\x03" +
		"\x02\x02\x02\u0387\u0385\x03\x02\x02\x02\u0387\u0388\x03\x02\x02\x02\u0388" +
		"\xB5\x03\x02\x02\x02\u0389\u0387\x03\x02\x02\x02\u038A\u0391\x05\xB8]" +
		"\x02\u038B\u038D\x07f\x02\x02\u038C\u038B\x03\x02\x02\x02\u038C\u038D" +
		"\x03\x02\x02\x02\u038D\u038E\x03\x02\x02\x02\u038E\u0390\x05\xB8]\x02" +
		"\u038F\u038C\x03\x02\x02\x02\u0390\u0393\x03\x02\x02\x02\u0391\u038F\x03" +
		"\x02\x02\x02\u0391\u0392\x03\x02\x02\x02\u0392\u0395\x03\x02\x02\x02\u0393" +
		"\u0391\x03\x02\x02\x02\u0394\u0396\x07f\x02\x02\u0395\u0394\x03\x02\x02" +
		"\x02\u0395\u0396\x03\x02\x02\x02\u0396\xB7\x03\x02\x02\x02\u0397\u03A0" +
		"\x05\xBA^\x02\u0398\u0399\x05\xBA^\x02\u0399\u039A\x07g\x02\x02\u039A" +
		"\u039C\x03\x02\x02\x02\u039B\u0398\x03\x02\x02\x02\u039B\u039C\x03\x02" +
		"\x02\x02\u039C\u039D\x03\x02\x02\x02\u039D\u03A0\t\x13\x02\x02\u039E\u03A0" +
		"\x05L\'\x02\u039F\u0397\x03\x02\x02\x02\u039F\u039B\x03\x02\x02\x02\u039F" +
		"\u039E\x03\x02\x02\x02\u03A0\xB9\x03\x02\x02\x02\u03A1\u03A6\x05\xBE`" +
		"\x02\u03A2\u03A3\x07g\x02\x02\u03A3\u03A5\x05\xBE`\x02\u03A4\u03A2\x03" +
		"\x02\x02\x02\u03A5\u03A8\x03\x02\x02\x02\u03A6\u03A4\x03\x02\x02\x02\u03A6" +
		"\u03A7\x03\x02\x02\x02\u03A7\xBB\x03\x02\x02\x02\u03A8\u03A6\x03\x02\x02" +
		"\x02\u03A9\u03AA\x05\xA4S\x02\u03AA\xBD\x03\x02\x02\x02\u03AB\u03AC\x05" +
		"\xA4S\x02\u03AC\xBF\x03\x02\x02\x02\u03AD\u03AE\x05\xAAV\x02\u03AE\u03AF" +
		"\x07\x02\x02\x03\u03AF\xC1\x03\x02\x02\x02\u03B0\u03B1\x05\xC4c\x02\u03B1" +
		"\xC3\x03\x02\x02\x02\u03B2\u03BB\x07\x03\x02\x02\u03B3\u03BB\x07\x80\x02" +
		"\x02\u03B4\u03BB\x07\x81\x02\x02\u03B5\u03BB\x05\xC6d\x02\u03B6\u03BB" +
		"\x05\xCAf\x02\u03B7\u03BB\x07Q\x02\x02\u03B8\u03BB\x072\x02\x02\u03B9" +
		"\u03BB\x07B\x02\x02\u03BA\u03B2\x03\x02\x02\x02\u03BA\u03B3\x03\x02\x02" +
		"\x02\u03BA\u03B4\x03\x02\x02\x02\u03BA\u03B5\x03\x02\x02\x02\u03BA\u03B6" +
		"\x03\x02\x02\x02\u03BA\u03B7\x03\x02\x02\x02\u03BA\u03B8\x03\x02\x02\x02" +
		"\u03BA\u03B9\x03\x02\x02\x02\u03BB\xC5\x03\x02\x02\x02\u03BC\u03BD\x07" +
		"b\x02\x02\u03BD\u03C2\x05\xC8e\x02\u03BE\u03BF\x07f\x02\x02\u03BF\u03C1" +
		"\x05\xC8e\x02\u03C0\u03BE\x03\x02\x02\x02\u03C1\u03C4\x03\x02\x02\x02" +
		"\u03C2\u03C0\x03\x02\x02\x02\u03C2\u03C3\x03\x02\x02\x02\u03C3\u03C5\x03" +
		"\x02\x02\x02\u03C4\u03C2\x03\x02\x02\x02\u03C5\u03C6\x07c\x02\x02\u03C6" +
		"\u03CA\x03\x02\x02\x02\u03C7\u03C8\x07b\x02\x02\u03C8\u03CA\x07c\x02\x02" +
		"\u03C9\u03BC\x03\x02\x02\x02\u03C9\u03C7\x03\x02\x02\x02\u03CA\xC7\x03" +
		"\x02\x02\x02\u03CB\u03CC\x07\x03\x02\x02\u03CC\u03CD\x07e\x02\x02\u03CD" +
		"\u03CE\x05\xC4c\x02\u03CE\xC9\x03\x02\x02\x02\u03CF\u03D0\x07`\x02\x02" +
		"\u03D0\u03D5\x05\xC4c\x02\u03D1\u03D2\x07f\x02\x02\u03D2\u03D4\x05\xC4" +
		"c\x02\u03D3\u03D1\x03\x02\x02\x02\u03D4\u03D7\x03\x02\x02\x02\u03D5\u03D3" +
		"\x03\x02\x02\x02\u03D5\u03D6\x03\x02\x02\x02\u03D6\u03D8\x03\x02\x02\x02" +
		"\u03D7\u03D5\x03\x02\x02\x02\u03D8\u03D9\x07a\x02\x02\u03D9\u03DD\x03" +
		"\x02\x02\x02\u03DA\u03DB\x07`\x02\x02\u03DB\u03DD\x07a\x02\x02\u03DC\u03CF" +
		"\x03\x02\x02\x02\u03DC\u03DA\x03\x02\x02\x02\u03DD\xCB\x03\x02\x02\x02" +
		"\u03DE\u03DF\x05\xA4S\x02\u03DF\xCD\x03\x02\x02\x02\u03E0\u03E1\x05\xA4" +
		"S\x02\u03E1\xCF\x03\x02\x02\x02\u03E2\u03E3\x07\x03\x02\x02\u03E3\xD1" +
		"\x03\x02\x02\x02q\xD4\xD6\xDF\xEA\xF2\xFA\u0102\u0108\u0118\u011D\u0121" +
		"\u0130\u0133\u0138\u013B\u0141\u0147\u014A\u014C\u015A\u015C\u0160\u016D" +
		"\u0172\u0176\u017E\u0181\u018F\u0198\u019A\u019F\u01B0\u01B4\u01B9\u01BD" +
		"\u01C5\u01CA\u01CE\u01D2\u01D7\u01DB\u01EA\u01EF\u01F3\u01FB\u01FF\u0204" +
		"\u0208\u020D\u0215\u0219\u021B\u0221\u0226\u022D\u0231\u023B\u0240\u0244" +
		"\u0259\u0260\u0265\u0269\u026F\u0276\u027B\u027F\u0283\u0286\u028C\u0299" +
		"\u029E\u02A2\u02A6\u02A9\u02B2\u02B7\u02BC\u02BF\u02C3\u02C8\u02CF\u02E3" +
		"\u02EB\u030C\u0312\u031C\u0320\u032C\u0331\u035B\u035D\u0361\u0368\u036C" +
		"\u0370\u037A\u037E\u0382\u0387\u038C\u0391\u0395\u039B\u039F\u03A6\u03BA" +
		"\u03C2\u03C9\u03D5\u03DC";
	public static readonly _serializedATN: string = Utils.join(
		[
			MalloyParser._serializedATNSegment0,
			MalloyParser._serializedATNSegment1,
		],
		"",
	);
	public static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!MalloyParser.__ATN) {
			MalloyParser.__ATN = new ATNDeserializer().deserialize(Utils.toCharArray(MalloyParser._serializedATN));
		}

		return MalloyParser.__ATN;
	}

}

export class MalloyDocumentContext extends ParserRuleContext {
	public EOF(): TerminalNode { return this.getToken(MalloyParser.EOF, 0); }
	public malloyStatement(): MalloyStatementContext[];
	public malloyStatement(i: number): MalloyStatementContext;
	public malloyStatement(i?: number): MalloyStatementContext | MalloyStatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(MalloyStatementContext);
		} else {
			return this.getRuleContext(i, MalloyStatementContext);
		}
	}
	public SEMI(): TerminalNode[];
	public SEMI(i: number): TerminalNode;
	public SEMI(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.SEMI);
		} else {
			return this.getToken(MalloyParser.SEMI, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_malloyDocument; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterMalloyDocument) {
			listener.enterMalloyDocument(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitMalloyDocument) {
			listener.exitMalloyDocument(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitMalloyDocument) {
			return visitor.visitMalloyDocument(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MalloyStatementContext extends ParserRuleContext {
	public defineExploreStatement(): DefineExploreStatementContext | undefined {
		return this.tryGetRuleContext(0, DefineExploreStatementContext);
	}
	public defineSQLStatement(): DefineSQLStatementContext | undefined {
		return this.tryGetRuleContext(0, DefineSQLStatementContext);
	}
	public defineQuery(): DefineQueryContext | undefined {
		return this.tryGetRuleContext(0, DefineQueryContext);
	}
	public importStatement(): ImportStatementContext | undefined {
		return this.tryGetRuleContext(0, ImportStatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_malloyStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterMalloyStatement) {
			listener.enterMalloyStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitMalloyStatement) {
			listener.exitMalloyStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitMalloyStatement) {
			return visitor.visitMalloyStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DefineExploreStatementContext extends ParserRuleContext {
	public exploreKeyword(): ExploreKeywordContext {
		return this.getRuleContext(0, ExploreKeywordContext);
	}
	public exploreDefinitionList(): ExploreDefinitionListContext {
		return this.getRuleContext(0, ExploreDefinitionListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_defineExploreStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefineExploreStatement) {
			listener.enterDefineExploreStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefineExploreStatement) {
			listener.exitDefineExploreStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefineExploreStatement) {
			return visitor.visitDefineExploreStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreKeywordContext extends ParserRuleContext {
	public EXPLORE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.EXPLORE, 0); }
	public SOURCE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.SOURCE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreKeyword; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreKeyword) {
			listener.enterExploreKeyword(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreKeyword) {
			listener.exitExploreKeyword(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreKeyword) {
			return visitor.visitExploreKeyword(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DefineQueryContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_defineQuery; }
	public copyFrom(ctx: DefineQueryContext): void {
		super.copyFrom(ctx);
	}
}
export class NamedQueries_stubContext extends DefineQueryContext {
	public QUERY(): TerminalNode { return this.getToken(MalloyParser.QUERY, 0); }
	public topLevelQueryDefs(): TopLevelQueryDefsContext {
		return this.getRuleContext(0, TopLevelQueryDefsContext);
	}
	constructor(ctx: DefineQueryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNamedQueries_stub) {
			listener.enterNamedQueries_stub(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNamedQueries_stub) {
			listener.exitNamedQueries_stub(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNamedQueries_stub) {
			return visitor.visitNamedQueries_stub(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AnonymousQueryContext extends DefineQueryContext {
	public QUERY(): TerminalNode { return this.getToken(MalloyParser.QUERY, 0); }
	public topLevelAnonQueryDef(): TopLevelAnonQueryDefContext {
		return this.getRuleContext(0, TopLevelAnonQueryDefContext);
	}
	constructor(ctx: DefineQueryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterAnonymousQuery) {
			listener.enterAnonymousQuery(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitAnonymousQuery) {
			listener.exitAnonymousQuery(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitAnonymousQuery) {
			return visitor.visitAnonymousQuery(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TopLevelAnonQueryDefContext extends ParserRuleContext {
	public query(): QueryContext {
		return this.getRuleContext(0, QueryContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_topLevelAnonQueryDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTopLevelAnonQueryDef) {
			listener.enterTopLevelAnonQueryDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTopLevelAnonQueryDef) {
			listener.exitTopLevelAnonQueryDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTopLevelAnonQueryDef) {
			return visitor.visitTopLevelAnonQueryDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DefineSQLStatementContext extends ParserRuleContext {
	public SQL(): TerminalNode { return this.getToken(MalloyParser.SQL, 0); }
	public sqlBlock(): SqlBlockContext {
		return this.getRuleContext(0, SqlBlockContext);
	}
	public nameSQLBlock(): NameSQLBlockContext | undefined {
		return this.tryGetRuleContext(0, NameSQLBlockContext);
	}
	public IS(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.IS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_defineSQLStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefineSQLStatement) {
			listener.enterDefineSQLStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefineSQLStatement) {
			listener.exitDefineSQLStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefineSQLStatement) {
			return visitor.visitDefineSQLStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SqlBlockContext extends ParserRuleContext {
	public OCURLY(): TerminalNode { return this.getToken(MalloyParser.OCURLY, 0); }
	public CCURLY(): TerminalNode { return this.getToken(MalloyParser.CCURLY, 0); }
	public blockSQLDef(): BlockSQLDefContext[];
	public blockSQLDef(i: number): BlockSQLDefContext;
	public blockSQLDef(i?: number): BlockSQLDefContext | BlockSQLDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(BlockSQLDefContext);
		} else {
			return this.getRuleContext(i, BlockSQLDefContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sqlBlock; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSqlBlock) {
			listener.enterSqlBlock(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSqlBlock) {
			listener.exitSqlBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSqlBlock) {
			return visitor.visitSqlBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BlockSQLDefContext extends ParserRuleContext {
	public CONNECTION(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.CONNECTION, 0); }
	public connectionName(): ConnectionNameContext | undefined {
		return this.tryGetRuleContext(0, ConnectionNameContext);
	}
	public SELECT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.SELECT, 0); }
	public sqlString(): SqlStringContext | undefined {
		return this.tryGetRuleContext(0, SqlStringContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_blockSQLDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterBlockSQLDef) {
			listener.enterBlockSQLDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitBlockSQLDef) {
			listener.exitBlockSQLDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitBlockSQLDef) {
			return visitor.visitBlockSQLDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SqlStringContext extends ParserRuleContext {
	public SQL_BEGIN(): TerminalNode { return this.getToken(MalloyParser.SQL_BEGIN, 0); }
	public SQL_END(): TerminalNode { return this.getToken(MalloyParser.SQL_END, 0); }
	public sqlInterpolation(): SqlInterpolationContext[];
	public sqlInterpolation(i: number): SqlInterpolationContext;
	public sqlInterpolation(i?: number): SqlInterpolationContext | SqlInterpolationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(SqlInterpolationContext);
		} else {
			return this.getRuleContext(i, SqlInterpolationContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sqlString; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSqlString) {
			listener.enterSqlString(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSqlString) {
			listener.exitSqlString(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSqlString) {
			return visitor.visitSqlString(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SqlInterpolationContext extends ParserRuleContext {
	public OPEN_CODE(): TerminalNode { return this.getToken(MalloyParser.OPEN_CODE, 0); }
	public query(): QueryContext {
		return this.getRuleContext(0, QueryContext);
	}
	public CLOSE_CODE(): TerminalNode { return this.getToken(MalloyParser.CLOSE_CODE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sqlInterpolation; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSqlInterpolation) {
			listener.enterSqlInterpolation(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSqlInterpolation) {
			listener.exitSqlInterpolation(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSqlInterpolation) {
			return visitor.visitSqlInterpolation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportStatementContext extends ParserRuleContext {
	public IMPORT(): TerminalNode { return this.getToken(MalloyParser.IMPORT, 0); }
	public importURL(): ImportURLContext {
		return this.getRuleContext(0, ImportURLContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_importStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterImportStatement) {
			listener.enterImportStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitImportStatement) {
			listener.exitImportStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitImportStatement) {
			return visitor.visitImportStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportURLContext extends ParserRuleContext {
	public JSON_STRING(): TerminalNode { return this.getToken(MalloyParser.JSON_STRING, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_importURL; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterImportURL) {
			listener.enterImportURL(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitImportURL) {
			listener.exitImportURL(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitImportURL) {
			return visitor.visitImportURL(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TopLevelQueryDefsContext extends ParserRuleContext {
	public topLevelQueryDef(): TopLevelQueryDefContext[];
	public topLevelQueryDef(i: number): TopLevelQueryDefContext;
	public topLevelQueryDef(i?: number): TopLevelQueryDefContext | TopLevelQueryDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(TopLevelQueryDefContext);
		} else {
			return this.getRuleContext(i, TopLevelQueryDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_topLevelQueryDefs; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTopLevelQueryDefs) {
			listener.enterTopLevelQueryDefs(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTopLevelQueryDefs) {
			listener.exitTopLevelQueryDefs(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTopLevelQueryDefs) {
			return visitor.visitTopLevelQueryDefs(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TopLevelQueryDefContext extends ParserRuleContext {
	public queryName(): QueryNameContext {
		return this.getRuleContext(0, QueryNameContext);
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	public query(): QueryContext {
		return this.getRuleContext(0, QueryContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_topLevelQueryDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTopLevelQueryDef) {
			listener.enterTopLevelQueryDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTopLevelQueryDef) {
			listener.exitTopLevelQueryDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTopLevelQueryDef) {
			return visitor.visitTopLevelQueryDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RefineOperatorContext extends ParserRuleContext {
	public PLUS(): TerminalNode { return this.getToken(MalloyParser.PLUS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_refineOperator; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterRefineOperator) {
			listener.enterRefineOperator(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitRefineOperator) {
			listener.exitRefineOperator(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitRefineOperator) {
			return visitor.visitRefineOperator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_query; }
	public copyFrom(ctx: QueryContext): void {
		super.copyFrom(ctx);
	}
}
export class ExploreArrowQueryContext extends QueryContext {
	public explore(): ExploreContext {
		return this.getRuleContext(0, ExploreContext);
	}
	public ARROW(): TerminalNode { return this.getToken(MalloyParser.ARROW, 0); }
	public pipelineFromName(): PipelineFromNameContext {
		return this.getRuleContext(0, PipelineFromNameContext);
	}
	constructor(ctx: QueryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreArrowQuery) {
			listener.enterExploreArrowQuery(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreArrowQuery) {
			listener.exitExploreArrowQuery(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreArrowQuery) {
			return visitor.visitExploreArrowQuery(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrowQueryContext extends QueryContext {
	public ARROW(): TerminalNode { return this.getToken(MalloyParser.ARROW, 0); }
	public queryName(): QueryNameContext {
		return this.getRuleContext(0, QueryNameContext);
	}
	public queryProperties(): QueryPropertiesContext | undefined {
		return this.tryGetRuleContext(0, QueryPropertiesContext);
	}
	public pipeElement(): PipeElementContext[];
	public pipeElement(i: number): PipeElementContext;
	public pipeElement(i?: number): PipeElementContext | PipeElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(PipeElementContext);
		} else {
			return this.getRuleContext(i, PipeElementContext);
		}
	}
	public refineOperator(): RefineOperatorContext | undefined {
		return this.tryGetRuleContext(0, RefineOperatorContext);
	}
	constructor(ctx: QueryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterArrowQuery) {
			listener.enterArrowQuery(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitArrowQuery) {
			listener.exitArrowQuery(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitArrowQuery) {
			return visitor.visitArrowQuery(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PipelineFromNameContext extends ParserRuleContext {
	public firstSegment(): FirstSegmentContext {
		return this.getRuleContext(0, FirstSegmentContext);
	}
	public pipeElement(): PipeElementContext[];
	public pipeElement(i: number): PipeElementContext;
	public pipeElement(i?: number): PipeElementContext | PipeElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(PipeElementContext);
		} else {
			return this.getRuleContext(i, PipeElementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_pipelineFromName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterPipelineFromName) {
			listener.enterPipelineFromName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitPipelineFromName) {
			listener.exitPipelineFromName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitPipelineFromName) {
			return visitor.visitPipelineFromName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FirstSegmentContext extends ParserRuleContext {
	public queryProperties(): QueryPropertiesContext | undefined {
		return this.tryGetRuleContext(0, QueryPropertiesContext);
	}
	public exploreQueryName(): ExploreQueryNameContext | undefined {
		return this.tryGetRuleContext(0, ExploreQueryNameContext);
	}
	public refineOperator(): RefineOperatorContext | undefined {
		return this.tryGetRuleContext(0, RefineOperatorContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_firstSegment; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFirstSegment) {
			listener.enterFirstSegment(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFirstSegment) {
			listener.exitFirstSegment(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFirstSegment) {
			return visitor.visitFirstSegment(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PipeElementContext extends ParserRuleContext {
	public ARROW(): TerminalNode { return this.getToken(MalloyParser.ARROW, 0); }
	public queryProperties(): QueryPropertiesContext {
		return this.getRuleContext(0, QueryPropertiesContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_pipeElement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterPipeElement) {
			listener.enterPipeElement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitPipeElement) {
			listener.exitPipeElement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitPipeElement) {
			return visitor.visitPipeElement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreTableContext extends ParserRuleContext {
	public TABLE(): TerminalNode { return this.getToken(MalloyParser.TABLE, 0); }
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public tableName(): TableNameContext {
		return this.getRuleContext(0, TableNameContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreTable; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreTable) {
			listener.enterExploreTable(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreTable) {
			listener.exitExploreTable(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreTable) {
			return visitor.visitExploreTable(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryPropertiesContext extends ParserRuleContext {
	public filterShortcut(): FilterShortcutContext | undefined {
		return this.tryGetRuleContext(0, FilterShortcutContext);
	}
	public OCURLY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.OCURLY, 0); }
	public CCURLY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.CCURLY, 0); }
	public queryStatement(): QueryStatementContext[];
	public queryStatement(i: number): QueryStatementContext;
	public queryStatement(i?: number): QueryStatementContext | QueryStatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(QueryStatementContext);
		} else {
			return this.getRuleContext(i, QueryStatementContext);
		}
	}
	public SEMI(): TerminalNode[];
	public SEMI(i: number): TerminalNode;
	public SEMI(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.SEMI);
		} else {
			return this.getToken(MalloyParser.SEMI, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_queryProperties; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryProperties) {
			listener.enterQueryProperties(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryProperties) {
			listener.exitQueryProperties(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryProperties) {
			return visitor.visitQueryProperties(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FilterShortcutContext extends ParserRuleContext {
	public OCURLY(): TerminalNode { return this.getToken(MalloyParser.OCURLY, 0); }
	public QMARK(): TerminalNode { return this.getToken(MalloyParser.QMARK, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public CCURLY(): TerminalNode { return this.getToken(MalloyParser.CCURLY, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_filterShortcut; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFilterShortcut) {
			listener.enterFilterShortcut(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFilterShortcut) {
			listener.exitFilterShortcut(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFilterShortcut) {
			return visitor.visitFilterShortcut(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreQueryNameContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreQueryName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreQueryName) {
			listener.enterExploreQueryName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreQueryName) {
			listener.exitExploreQueryName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreQueryName) {
			return visitor.visitExploreQueryName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryNameContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_queryName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryName) {
			listener.enterQueryName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryName) {
			listener.exitQueryName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryName) {
			return visitor.visitQueryName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreDefinitionListContext extends ParserRuleContext {
	public exploreDefinition(): ExploreDefinitionContext[];
	public exploreDefinition(i: number): ExploreDefinitionContext;
	public exploreDefinition(i?: number): ExploreDefinitionContext | ExploreDefinitionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExploreDefinitionContext);
		} else {
			return this.getRuleContext(i, ExploreDefinitionContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreDefinitionList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreDefinitionList) {
			listener.enterExploreDefinitionList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreDefinitionList) {
			listener.exitExploreDefinitionList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreDefinitionList) {
			return visitor.visitExploreDefinitionList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreDefinitionContext extends ParserRuleContext {
	public exploreNameDef(): ExploreNameDefContext {
		return this.getRuleContext(0, ExploreNameDefContext);
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	public explore(): ExploreContext {
		return this.getRuleContext(0, ExploreContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreDefinition; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreDefinition) {
			listener.enterExploreDefinition(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreDefinition) {
			listener.exitExploreDefinition(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreDefinition) {
			return visitor.visitExploreDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreContext extends ParserRuleContext {
	public exploreSource(): ExploreSourceContext {
		return this.getRuleContext(0, ExploreSourceContext);
	}
	public exploreProperties(): ExplorePropertiesContext | undefined {
		return this.tryGetRuleContext(0, ExplorePropertiesContext);
	}
	public refineOperator(): RefineOperatorContext | undefined {
		return this.tryGetRuleContext(0, RefineOperatorContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_explore; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExplore) {
			listener.enterExplore(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExplore) {
			listener.exitExplore(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExplore) {
			return visitor.visitExplore(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreSourceContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreSource; }
	public copyFrom(ctx: ExploreSourceContext): void {
		super.copyFrom(ctx);
	}
}
export class NamedSourceContext extends ExploreSourceContext {
	public exploreName(): ExploreNameContext {
		return this.getRuleContext(0, ExploreNameContext);
	}
	constructor(ctx: ExploreSourceContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNamedSource) {
			listener.enterNamedSource(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNamedSource) {
			listener.exitNamedSource(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNamedSource) {
			return visitor.visitNamedSource(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TableSourceContext extends ExploreSourceContext {
	public exploreTable(): ExploreTableContext {
		return this.getRuleContext(0, ExploreTableContext);
	}
	constructor(ctx: ExploreSourceContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTableSource) {
			listener.enterTableSource(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTableSource) {
			listener.exitTableSource(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTableSource) {
			return visitor.visitTableSource(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class QuerySourceContext extends ExploreSourceContext {
	public FROM(): TerminalNode { return this.getToken(MalloyParser.FROM, 0); }
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public query(): QueryContext {
		return this.getRuleContext(0, QueryContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(ctx: ExploreSourceContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQuerySource) {
			listener.enterQuerySource(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQuerySource) {
			listener.exitQuerySource(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQuerySource) {
			return visitor.visitQuerySource(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SQLSourceNameContext extends ExploreSourceContext {
	public FROM_SQL(): TerminalNode { return this.getToken(MalloyParser.FROM_SQL, 0); }
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public sqlExploreNameRef(): SqlExploreNameRefContext {
		return this.getRuleContext(0, SqlExploreNameRefContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(ctx: ExploreSourceContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSQLSourceName) {
			listener.enterSQLSourceName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSQLSourceName) {
			listener.exitSQLSourceName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSQLSourceName) {
			return visitor.visitSQLSourceName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreNameDefContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreNameDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreNameDef) {
			listener.enterExploreNameDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreNameDef) {
			listener.exitExploreNameDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreNameDef) {
			return visitor.visitExploreNameDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreNameContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreName) {
			listener.enterExploreName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreName) {
			listener.exitExploreName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreName) {
			return visitor.visitExploreName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExplorePropertiesContext extends ParserRuleContext {
	public OCURLY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.OCURLY, 0); }
	public CCURLY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.CCURLY, 0); }
	public exploreStatement(): ExploreStatementContext[];
	public exploreStatement(i: number): ExploreStatementContext;
	public exploreStatement(i?: number): ExploreStatementContext | ExploreStatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExploreStatementContext);
		} else {
			return this.getRuleContext(i, ExploreStatementContext);
		}
	}
	public SEMI(): TerminalNode[];
	public SEMI(i: number): TerminalNode;
	public SEMI(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.SEMI);
		} else {
			return this.getToken(MalloyParser.SEMI, i);
		}
	}
	public filterShortcut(): FilterShortcutContext | undefined {
		return this.tryGetRuleContext(0, FilterShortcutContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreProperties; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreProperties) {
			listener.enterExploreProperties(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreProperties) {
			listener.exitExploreProperties(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreProperties) {
			return visitor.visitExploreProperties(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreStatementContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreStatement; }
	public copyFrom(ctx: ExploreStatementContext): void {
		super.copyFrom(ctx);
	}
}
export class DefExploreDimensionContext extends ExploreStatementContext {
	public DIMENSION(): TerminalNode { return this.getToken(MalloyParser.DIMENSION, 0); }
	public dimensionDefList(): DimensionDefListContext {
		return this.getRuleContext(0, DimensionDefListContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreDimension) {
			listener.enterDefExploreDimension(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreDimension) {
			listener.exitDefExploreDimension(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreDimension) {
			return visitor.visitDefExploreDimension(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExploreMeasureContext extends ExploreStatementContext {
	public MEASURE(): TerminalNode { return this.getToken(MalloyParser.MEASURE, 0); }
	public measureDefList(): MeasureDefListContext {
		return this.getRuleContext(0, MeasureDefListContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreMeasure) {
			listener.enterDefExploreMeasure(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreMeasure) {
			listener.exitDefExploreMeasure(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreMeasure) {
			return visitor.visitDefExploreMeasure(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefDeclare_stubContext extends ExploreStatementContext {
	public declareStatement(): DeclareStatementContext {
		return this.getRuleContext(0, DeclareStatementContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefDeclare_stub) {
			listener.enterDefDeclare_stub(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefDeclare_stub) {
			listener.exitDefDeclare_stub(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefDeclare_stub) {
			return visitor.visitDefDeclare_stub(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefJoin_stubContext extends ExploreStatementContext {
	public joinStatement(): JoinStatementContext {
		return this.getRuleContext(0, JoinStatementContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefJoin_stub) {
			listener.enterDefJoin_stub(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefJoin_stub) {
			listener.exitDefJoin_stub(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefJoin_stub) {
			return visitor.visitDefJoin_stub(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExploreWhereContext extends ExploreStatementContext {
	public whereStatement(): WhereStatementContext {
		return this.getRuleContext(0, WhereStatementContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreWhere) {
			listener.enterDefExploreWhere(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreWhere) {
			listener.exitDefExploreWhere(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreWhere) {
			return visitor.visitDefExploreWhere(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExplorePrimaryKeyContext extends ExploreStatementContext {
	public PRIMARY_KEY(): TerminalNode { return this.getToken(MalloyParser.PRIMARY_KEY, 0); }
	public fieldName(): FieldNameContext {
		return this.getRuleContext(0, FieldNameContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExplorePrimaryKey) {
			listener.enterDefExplorePrimaryKey(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExplorePrimaryKey) {
			listener.exitDefExplorePrimaryKey(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExplorePrimaryKey) {
			return visitor.visitDefExplorePrimaryKey(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExploreRenameContext extends ExploreStatementContext {
	public RENAME(): TerminalNode { return this.getToken(MalloyParser.RENAME, 0); }
	public renameList(): RenameListContext {
		return this.getRuleContext(0, RenameListContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreRename) {
			listener.enterDefExploreRename(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreRename) {
			listener.exitDefExploreRename(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreRename) {
			return visitor.visitDefExploreRename(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExploreEditFieldContext extends ExploreStatementContext {
	public fieldNameList(): FieldNameListContext {
		return this.getRuleContext(0, FieldNameListContext);
	}
	public ACCEPT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.ACCEPT, 0); }
	public EXCEPT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.EXCEPT, 0); }
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreEditField) {
			listener.enterDefExploreEditField(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreEditField) {
			listener.exitDefExploreEditField(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreEditField) {
			return visitor.visitDefExploreEditField(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefExploreQueryContext extends ExploreStatementContext {
	public QUERY(): TerminalNode { return this.getToken(MalloyParser.QUERY, 0); }
	public subQueryDefList(): SubQueryDefListContext {
		return this.getRuleContext(0, SubQueryDefListContext);
	}
	constructor(ctx: ExploreStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefExploreQuery) {
			listener.enterDefExploreQuery(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefExploreQuery) {
			listener.exitDefExploreQuery(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefExploreQuery) {
			return visitor.visitDefExploreQuery(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RenameListContext extends ParserRuleContext {
	public exploreRenameDef(): ExploreRenameDefContext[];
	public exploreRenameDef(i: number): ExploreRenameDefContext;
	public exploreRenameDef(i?: number): ExploreRenameDefContext | ExploreRenameDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExploreRenameDefContext);
		} else {
			return this.getRuleContext(i, ExploreRenameDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_renameList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterRenameList) {
			listener.enterRenameList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitRenameList) {
			listener.exitRenameList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitRenameList) {
			return visitor.visitRenameList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreRenameDefContext extends ParserRuleContext {
	public fieldName(): FieldNameContext[];
	public fieldName(i: number): FieldNameContext;
	public fieldName(i?: number): FieldNameContext | FieldNameContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldNameContext);
		} else {
			return this.getRuleContext(i, FieldNameContext);
		}
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreRenameDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreRenameDef) {
			listener.enterExploreRenameDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreRenameDef) {
			listener.exitExploreRenameDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreRenameDef) {
			return visitor.visitExploreRenameDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DimensionDefListContext extends ParserRuleContext {
	public dimensionDef(): DimensionDefContext[];
	public dimensionDef(i: number): DimensionDefContext;
	public dimensionDef(i?: number): DimensionDefContext | DimensionDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(DimensionDefContext);
		} else {
			return this.getRuleContext(i, DimensionDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_dimensionDefList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDimensionDefList) {
			listener.enterDimensionDefList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDimensionDefList) {
			listener.exitDimensionDefList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDimensionDefList) {
			return visitor.visitDimensionDefList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MeasureDefListContext extends ParserRuleContext {
	public measureDef(): MeasureDefContext[];
	public measureDef(i: number): MeasureDefContext;
	public measureDef(i?: number): MeasureDefContext | MeasureDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(MeasureDefContext);
		} else {
			return this.getRuleContext(i, MeasureDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_measureDefList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterMeasureDefList) {
			listener.enterMeasureDefList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitMeasureDefList) {
			listener.exitMeasureDefList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitMeasureDefList) {
			return visitor.visitMeasureDefList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldDefContext extends ParserRuleContext {
	public fieldNameDef(): FieldNameDefContext {
		return this.getRuleContext(0, FieldNameDefContext);
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldDef) {
			listener.enterFieldDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldDef) {
			listener.exitFieldDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldDef) {
			return visitor.visitFieldDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldNameDefContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldNameDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldNameDef) {
			listener.enterFieldNameDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldNameDef) {
			listener.exitFieldNameDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldNameDef) {
			return visitor.visitFieldNameDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinNameDefContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinNameDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinNameDef) {
			listener.enterJoinNameDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinNameDef) {
			listener.exitJoinNameDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinNameDef) {
			return visitor.visitJoinNameDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MeasureDefContext extends ParserRuleContext {
	public fieldDef(): FieldDefContext {
		return this.getRuleContext(0, FieldDefContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_measureDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterMeasureDef) {
			listener.enterMeasureDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitMeasureDef) {
			listener.exitMeasureDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitMeasureDef) {
			return visitor.visitMeasureDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DeclareStatementContext extends ParserRuleContext {
	public DECLARE(): TerminalNode { return this.getToken(MalloyParser.DECLARE, 0); }
	public fieldDef(): FieldDefContext[];
	public fieldDef(i: number): FieldDefContext;
	public fieldDef(i?: number): FieldDefContext | FieldDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldDefContext);
		} else {
			return this.getRuleContext(i, FieldDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_declareStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDeclareStatement) {
			listener.enterDeclareStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDeclareStatement) {
			listener.exitDeclareStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDeclareStatement) {
			return visitor.visitDeclareStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinStatementContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinStatement; }
	public copyFrom(ctx: JoinStatementContext): void {
		super.copyFrom(ctx);
	}
}
export class DefJoinOneContext extends JoinStatementContext {
	public JOIN_ONE(): TerminalNode { return this.getToken(MalloyParser.JOIN_ONE, 0); }
	public joinList(): JoinListContext {
		return this.getRuleContext(0, JoinListContext);
	}
	constructor(ctx: JoinStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefJoinOne) {
			listener.enterDefJoinOne(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefJoinOne) {
			listener.exitDefJoinOne(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefJoinOne) {
			return visitor.visitDefJoinOne(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefJoinManyContext extends JoinStatementContext {
	public JOIN_MANY(): TerminalNode { return this.getToken(MalloyParser.JOIN_MANY, 0); }
	public joinList(): JoinListContext {
		return this.getRuleContext(0, JoinListContext);
	}
	constructor(ctx: JoinStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefJoinMany) {
			listener.enterDefJoinMany(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefJoinMany) {
			listener.exitDefJoinMany(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefJoinMany) {
			return visitor.visitDefJoinMany(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DefJoinCrossContext extends JoinStatementContext {
	public JOIN_CROSS(): TerminalNode { return this.getToken(MalloyParser.JOIN_CROSS, 0); }
	public joinList(): JoinListContext {
		return this.getRuleContext(0, JoinListContext);
	}
	constructor(ctx: JoinStatementContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDefJoinCross) {
			listener.enterDefJoinCross(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDefJoinCross) {
			listener.exitDefJoinCross(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDefJoinCross) {
			return visitor.visitDefJoinCross(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinListContext extends ParserRuleContext {
	public joinDef(): JoinDefContext[];
	public joinDef(i: number): JoinDefContext;
	public joinDef(i?: number): JoinDefContext | JoinDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(JoinDefContext);
		} else {
			return this.getRuleContext(i, JoinDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinList) {
			listener.enterJoinList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinList) {
			listener.exitJoinList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinList) {
			return visitor.visitJoinList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinDefContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinDef; }
	public copyFrom(ctx: JoinDefContext): void {
		super.copyFrom(ctx);
	}
}
export class JoinWithContext extends JoinDefContext {
	public joinNameDef(): JoinNameDefContext {
		return this.getRuleContext(0, JoinNameDefContext);
	}
	public WITH(): TerminalNode { return this.getToken(MalloyParser.WITH, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public IS(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.IS, 0); }
	public explore(): ExploreContext | undefined {
		return this.tryGetRuleContext(0, ExploreContext);
	}
	constructor(ctx: JoinDefContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinWith) {
			listener.enterJoinWith(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinWith) {
			listener.exitJoinWith(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinWith) {
			return visitor.visitJoinWith(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class JoinOnContext extends JoinDefContext {
	public joinNameDef(): JoinNameDefContext {
		return this.getRuleContext(0, JoinNameDefContext);
	}
	public IS(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.IS, 0); }
	public explore(): ExploreContext | undefined {
		return this.tryGetRuleContext(0, ExploreContext);
	}
	public ON(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.ON, 0); }
	public joinExpression(): JoinExpressionContext | undefined {
		return this.tryGetRuleContext(0, JoinExpressionContext);
	}
	constructor(ctx: JoinDefContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinOn) {
			listener.enterJoinOn(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinOn) {
			listener.exitJoinOn(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinOn) {
			return visitor.visitJoinOn(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinExpressionContext extends ParserRuleContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinExpression; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinExpression) {
			listener.enterJoinExpression(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinExpression) {
			listener.exitJoinExpression(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinExpression) {
			return visitor.visitJoinExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FilterStatementContext extends ParserRuleContext {
	public whereStatement(): WhereStatementContext | undefined {
		return this.tryGetRuleContext(0, WhereStatementContext);
	}
	public havingStatement(): HavingStatementContext | undefined {
		return this.tryGetRuleContext(0, HavingStatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_filterStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFilterStatement) {
			listener.enterFilterStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFilterStatement) {
			listener.exitFilterStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFilterStatement) {
			return visitor.visitFilterStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FilteredByContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_filteredBy; }
	public copyFrom(ctx: FilteredByContext): void {
		super.copyFrom(ctx);
	}
}
export class FilterByShortcutContext extends FilteredByContext {
	public QMARK(): TerminalNode { return this.getToken(MalloyParser.QMARK, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	constructor(ctx: FilteredByContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFilterByShortcut) {
			listener.enterFilterByShortcut(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFilterByShortcut) {
			listener.exitFilterByShortcut(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFilterByShortcut) {
			return visitor.visitFilterByShortcut(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FilterByWhereContext extends FilteredByContext {
	public whereStatement(): WhereStatementContext {
		return this.getRuleContext(0, WhereStatementContext);
	}
	constructor(ctx: FilteredByContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFilterByWhere) {
			listener.enterFilterByWhere(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFilterByWhere) {
			listener.exitFilterByWhere(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFilterByWhere) {
			return visitor.visitFilterByWhere(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FilterClauseListContext extends ParserRuleContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_filterClauseList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFilterClauseList) {
			listener.enterFilterClauseList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFilterClauseList) {
			listener.exitFilterClauseList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFilterClauseList) {
			return visitor.visitFilterClauseList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class WhereStatementContext extends ParserRuleContext {
	public WHERE(): TerminalNode { return this.getToken(MalloyParser.WHERE, 0); }
	public filterClauseList(): FilterClauseListContext {
		return this.getRuleContext(0, FilterClauseListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_whereStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterWhereStatement) {
			listener.enterWhereStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitWhereStatement) {
			listener.exitWhereStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitWhereStatement) {
			return visitor.visitWhereStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class HavingStatementContext extends ParserRuleContext {
	public HAVING(): TerminalNode { return this.getToken(MalloyParser.HAVING, 0); }
	public filterClauseList(): FilterClauseListContext {
		return this.getRuleContext(0, FilterClauseListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_havingStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterHavingStatement) {
			listener.enterHavingStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitHavingStatement) {
			listener.exitHavingStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitHavingStatement) {
			return visitor.visitHavingStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SubQueryDefListContext extends ParserRuleContext {
	public exploreQueryDef(): ExploreQueryDefContext[];
	public exploreQueryDef(i: number): ExploreQueryDefContext;
	public exploreQueryDef(i?: number): ExploreQueryDefContext | ExploreQueryDefContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExploreQueryDefContext);
		} else {
			return this.getRuleContext(i, ExploreQueryDefContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_subQueryDefList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSubQueryDefList) {
			listener.enterSubQueryDefList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSubQueryDefList) {
			listener.exitSubQueryDefList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSubQueryDefList) {
			return visitor.visitSubQueryDefList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreQueryNameDefContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreQueryNameDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreQueryNameDef) {
			listener.enterExploreQueryNameDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreQueryNameDef) {
			listener.exitExploreQueryNameDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreQueryNameDef) {
			return visitor.visitExploreQueryNameDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExploreQueryDefContext extends ParserRuleContext {
	public exploreQueryNameDef(): ExploreQueryNameDefContext {
		return this.getRuleContext(0, ExploreQueryNameDefContext);
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	public pipelineFromName(): PipelineFromNameContext {
		return this.getRuleContext(0, PipelineFromNameContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_exploreQueryDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExploreQueryDef) {
			listener.enterExploreQueryDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExploreQueryDef) {
			listener.exitExploreQueryDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExploreQueryDef) {
			return visitor.visitExploreQueryDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryStatementContext extends ParserRuleContext {
	public groupByStatement(): GroupByStatementContext | undefined {
		return this.tryGetRuleContext(0, GroupByStatementContext);
	}
	public declareStatement(): DeclareStatementContext | undefined {
		return this.tryGetRuleContext(0, DeclareStatementContext);
	}
	public joinStatement(): JoinStatementContext | undefined {
		return this.tryGetRuleContext(0, JoinStatementContext);
	}
	public projectStatement(): ProjectStatementContext | undefined {
		return this.tryGetRuleContext(0, ProjectStatementContext);
	}
	public indexStatement(): IndexStatementContext | undefined {
		return this.tryGetRuleContext(0, IndexStatementContext);
	}
	public aggregateStatement(): AggregateStatementContext | undefined {
		return this.tryGetRuleContext(0, AggregateStatementContext);
	}
	public topStatement(): TopStatementContext | undefined {
		return this.tryGetRuleContext(0, TopStatementContext);
	}
	public limitStatement(): LimitStatementContext | undefined {
		return this.tryGetRuleContext(0, LimitStatementContext);
	}
	public orderByStatement(): OrderByStatementContext | undefined {
		return this.tryGetRuleContext(0, OrderByStatementContext);
	}
	public whereStatement(): WhereStatementContext | undefined {
		return this.tryGetRuleContext(0, WhereStatementContext);
	}
	public havingStatement(): HavingStatementContext | undefined {
		return this.tryGetRuleContext(0, HavingStatementContext);
	}
	public nestStatement(): NestStatementContext | undefined {
		return this.tryGetRuleContext(0, NestStatementContext);
	}
	public sampleStatement(): SampleStatementContext | undefined {
		return this.tryGetRuleContext(0, SampleStatementContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_queryStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryStatement) {
			listener.enterQueryStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryStatement) {
			listener.exitQueryStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryStatement) {
			return visitor.visitQueryStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class GroupByStatementContext extends ParserRuleContext {
	public GROUP_BY(): TerminalNode { return this.getToken(MalloyParser.GROUP_BY, 0); }
	public queryFieldList(): QueryFieldListContext {
		return this.getRuleContext(0, QueryFieldListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_groupByStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterGroupByStatement) {
			listener.enterGroupByStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitGroupByStatement) {
			listener.exitGroupByStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitGroupByStatement) {
			return visitor.visitGroupByStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryFieldListContext extends ParserRuleContext {
	public queryFieldEntry(): QueryFieldEntryContext[];
	public queryFieldEntry(i: number): QueryFieldEntryContext;
	public queryFieldEntry(i?: number): QueryFieldEntryContext | QueryFieldEntryContext[] {
		if (i === undefined) {
			return this.getRuleContexts(QueryFieldEntryContext);
		} else {
			return this.getRuleContext(i, QueryFieldEntryContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_queryFieldList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryFieldList) {
			listener.enterQueryFieldList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryFieldList) {
			listener.exitQueryFieldList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryFieldList) {
			return visitor.visitQueryFieldList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DimensionDefContext extends ParserRuleContext {
	public fieldDef(): FieldDefContext {
		return this.getRuleContext(0, FieldDefContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_dimensionDef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterDimensionDef) {
			listener.enterDimensionDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitDimensionDef) {
			listener.exitDimensionDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitDimensionDef) {
			return visitor.visitDimensionDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class QueryFieldEntryContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_queryFieldEntry; }
	public copyFrom(ctx: QueryFieldEntryContext): void {
		super.copyFrom(ctx);
	}
}
export class QueryFieldRefContext extends QueryFieldEntryContext {
	public fieldPath(): FieldPathContext {
		return this.getRuleContext(0, FieldPathContext);
	}
	constructor(ctx: QueryFieldEntryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryFieldRef) {
			listener.enterQueryFieldRef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryFieldRef) {
			listener.exitQueryFieldRef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryFieldRef) {
			return visitor.visitQueryFieldRef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class QueryFieldDefContext extends QueryFieldEntryContext {
	public dimensionDef(): DimensionDefContext {
		return this.getRuleContext(0, DimensionDefContext);
	}
	constructor(ctx: QueryFieldEntryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterQueryFieldDef) {
			listener.enterQueryFieldDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitQueryFieldDef) {
			listener.exitQueryFieldDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitQueryFieldDef) {
			return visitor.visitQueryFieldDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NestStatementContext extends ParserRuleContext {
	public NEST(): TerminalNode { return this.getToken(MalloyParser.NEST, 0); }
	public nestedQueryList(): NestedQueryListContext {
		return this.getRuleContext(0, NestedQueryListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_nestStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNestStatement) {
			listener.enterNestStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNestStatement) {
			listener.exitNestStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNestStatement) {
			return visitor.visitNestStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NestedQueryListContext extends ParserRuleContext {
	public nestEntry(): NestEntryContext[];
	public nestEntry(i: number): NestEntryContext;
	public nestEntry(i?: number): NestEntryContext | NestEntryContext[] {
		if (i === undefined) {
			return this.getRuleContexts(NestEntryContext);
		} else {
			return this.getRuleContext(i, NestEntryContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_nestedQueryList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNestedQueryList) {
			listener.enterNestedQueryList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNestedQueryList) {
			listener.exitNestedQueryList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNestedQueryList) {
			return visitor.visitNestedQueryList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NestEntryContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_nestEntry; }
	public copyFrom(ctx: NestEntryContext): void {
		super.copyFrom(ctx);
	}
}
export class NestExistingContext extends NestEntryContext {
	public queryName(): QueryNameContext {
		return this.getRuleContext(0, QueryNameContext);
	}
	public queryProperties(): QueryPropertiesContext | undefined {
		return this.tryGetRuleContext(0, QueryPropertiesContext);
	}
	public refineOperator(): RefineOperatorContext | undefined {
		return this.tryGetRuleContext(0, RefineOperatorContext);
	}
	constructor(ctx: NestEntryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNestExisting) {
			listener.enterNestExisting(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNestExisting) {
			listener.exitNestExisting(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNestExisting) {
			return visitor.visitNestExisting(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NestDefContext extends NestEntryContext {
	public queryName(): QueryNameContext {
		return this.getRuleContext(0, QueryNameContext);
	}
	public IS(): TerminalNode { return this.getToken(MalloyParser.IS, 0); }
	public pipelineFromName(): PipelineFromNameContext {
		return this.getRuleContext(0, PipelineFromNameContext);
	}
	constructor(ctx: NestEntryContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNestDef) {
			listener.enterNestDef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNestDef) {
			listener.exitNestDef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNestDef) {
			return visitor.visitNestDef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AggregateStatementContext extends ParserRuleContext {
	public AGGREGATE(): TerminalNode { return this.getToken(MalloyParser.AGGREGATE, 0); }
	public queryFieldList(): QueryFieldListContext {
		return this.getRuleContext(0, QueryFieldListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_aggregateStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterAggregateStatement) {
			listener.enterAggregateStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitAggregateStatement) {
			listener.exitAggregateStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitAggregateStatement) {
			return visitor.visitAggregateStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ProjectStatementContext extends ParserRuleContext {
	public PROJECT(): TerminalNode { return this.getToken(MalloyParser.PROJECT, 0); }
	public fieldCollection(): FieldCollectionContext {
		return this.getRuleContext(0, FieldCollectionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_projectStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterProjectStatement) {
			listener.enterProjectStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitProjectStatement) {
			listener.exitProjectStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitProjectStatement) {
			return visitor.visitProjectStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class OrderByStatementContext extends ParserRuleContext {
	public ORDER_BY(): TerminalNode { return this.getToken(MalloyParser.ORDER_BY, 0); }
	public ordering(): OrderingContext {
		return this.getRuleContext(0, OrderingContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_orderByStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterOrderByStatement) {
			listener.enterOrderByStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitOrderByStatement) {
			listener.exitOrderByStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitOrderByStatement) {
			return visitor.visitOrderByStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class OrderingContext extends ParserRuleContext {
	public orderBySpec(): OrderBySpecContext[];
	public orderBySpec(i: number): OrderBySpecContext;
	public orderBySpec(i?: number): OrderBySpecContext | OrderBySpecContext[] {
		if (i === undefined) {
			return this.getRuleContexts(OrderBySpecContext);
		} else {
			return this.getRuleContext(i, OrderBySpecContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_ordering; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterOrdering) {
			listener.enterOrdering(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitOrdering) {
			listener.exitOrdering(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitOrdering) {
			return visitor.visitOrdering(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class OrderBySpecContext extends ParserRuleContext {
	public INTEGER_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.INTEGER_LITERAL, 0); }
	public fieldName(): FieldNameContext | undefined {
		return this.tryGetRuleContext(0, FieldNameContext);
	}
	public ASC(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.ASC, 0); }
	public DESC(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DESC, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_orderBySpec; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterOrderBySpec) {
			listener.enterOrderBySpec(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitOrderBySpec) {
			listener.exitOrderBySpec(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitOrderBySpec) {
			return visitor.visitOrderBySpec(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LimitStatementContext extends ParserRuleContext {
	public LIMIT(): TerminalNode { return this.getToken(MalloyParser.LIMIT, 0); }
	public INTEGER_LITERAL(): TerminalNode { return this.getToken(MalloyParser.INTEGER_LITERAL, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_limitStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLimitStatement) {
			listener.enterLimitStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLimitStatement) {
			listener.exitLimitStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLimitStatement) {
			return visitor.visitLimitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BySpecContext extends ParserRuleContext {
	public BY(): TerminalNode { return this.getToken(MalloyParser.BY, 0); }
	public fieldName(): FieldNameContext | undefined {
		return this.tryGetRuleContext(0, FieldNameContext);
	}
	public fieldExpr(): FieldExprContext | undefined {
		return this.tryGetRuleContext(0, FieldExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_bySpec; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterBySpec) {
			listener.enterBySpec(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitBySpec) {
			listener.exitBySpec(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitBySpec) {
			return visitor.visitBySpec(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TopStatementContext extends ParserRuleContext {
	public TOP(): TerminalNode { return this.getToken(MalloyParser.TOP, 0); }
	public INTEGER_LITERAL(): TerminalNode { return this.getToken(MalloyParser.INTEGER_LITERAL, 0); }
	public bySpec(): BySpecContext | undefined {
		return this.tryGetRuleContext(0, BySpecContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_topStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTopStatement) {
			listener.enterTopStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTopStatement) {
			listener.exitTopStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTopStatement) {
			return visitor.visitTopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IndexElementContext extends ParserRuleContext {
	public fieldPath(): FieldPathContext | undefined {
		return this.tryGetRuleContext(0, FieldPathContext);
	}
	public DOT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DOT, 0); }
	public STAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STAR, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_indexElement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterIndexElement) {
			listener.enterIndexElement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitIndexElement) {
			listener.exitIndexElement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitIndexElement) {
			return visitor.visitIndexElement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IndexFieldsContext extends ParserRuleContext {
	public indexElement(): IndexElementContext[];
	public indexElement(i: number): IndexElementContext;
	public indexElement(i?: number): IndexElementContext | IndexElementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(IndexElementContext);
		} else {
			return this.getRuleContext(i, IndexElementContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_indexFields; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterIndexFields) {
			listener.enterIndexFields(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitIndexFields) {
			listener.exitIndexFields(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitIndexFields) {
			return visitor.visitIndexFields(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IndexStatementContext extends ParserRuleContext {
	public INDEX(): TerminalNode { return this.getToken(MalloyParser.INDEX, 0); }
	public indexFields(): IndexFieldsContext {
		return this.getRuleContext(0, IndexFieldsContext);
	}
	public BY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.BY, 0); }
	public fieldName(): FieldNameContext | undefined {
		return this.tryGetRuleContext(0, FieldNameContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_indexStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterIndexStatement) {
			listener.enterIndexStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitIndexStatement) {
			listener.exitIndexStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitIndexStatement) {
			return visitor.visitIndexStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SampleStatementContext extends ParserRuleContext {
	public SAMPLE(): TerminalNode { return this.getToken(MalloyParser.SAMPLE, 0); }
	public sampleSpec(): SampleSpecContext {
		return this.getRuleContext(0, SampleSpecContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sampleStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSampleStatement) {
			listener.enterSampleStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSampleStatement) {
			listener.exitSampleStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSampleStatement) {
			return visitor.visitSampleStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SampleSpecContext extends ParserRuleContext {
	public PERCENT_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.PERCENT_LITERAL, 0); }
	public INTEGER_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.INTEGER_LITERAL, 0); }
	public TRUE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.TRUE, 0); }
	public FALSE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.FALSE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sampleSpec; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSampleSpec) {
			listener.enterSampleSpec(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSampleSpec) {
			listener.exitSampleSpec(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSampleSpec) {
			return visitor.visitSampleSpec(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AggregateContext extends ParserRuleContext {
	public SUM(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.SUM, 0); }
	public COUNT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.COUNT, 0); }
	public AVG(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.AVG, 0); }
	public MIN(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MIN, 0); }
	public MAX(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MAX, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_aggregate; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterAggregate) {
			listener.enterAggregate(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitAggregate) {
			listener.exitAggregate(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitAggregate) {
			return visitor.visitAggregate(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MalloyTypeContext extends ParserRuleContext {
	public STRING(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STRING, 0); }
	public NUMBER(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NUMBER, 0); }
	public BOOLEAN(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.BOOLEAN, 0); }
	public DATE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DATE, 0); }
	public TIMESTAMP(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.TIMESTAMP, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_malloyType; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterMalloyType) {
			listener.enterMalloyType(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitMalloyType) {
			listener.exitMalloyType(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitMalloyType) {
			return visitor.visitMalloyType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CompareOpContext extends ParserRuleContext {
	public MATCH(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MATCH, 0); }
	public NOT_MATCH(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NOT_MATCH, 0); }
	public GT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.GT, 0); }
	public LT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.LT, 0); }
	public GTE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.GTE, 0); }
	public LTE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.LTE, 0); }
	public EQ(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.EQ, 0); }
	public NE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_compareOp; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterCompareOp) {
			listener.enterCompareOp(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitCompareOp) {
			listener.exitCompareOp(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitCompareOp) {
			return visitor.visitCompareOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LiteralContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_literal; }
	public copyFrom(ctx: LiteralContext): void {
		super.copyFrom(ctx);
	}
}
export class ExprStringContext extends LiteralContext {
	public STRING_LITERAL(): TerminalNode { return this.getToken(MalloyParser.STRING_LITERAL, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprString) {
			listener.enterExprString(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprString) {
			listener.exitExprString(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprString) {
			return visitor.visitExprString(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprNumberContext extends LiteralContext {
	public NUMERIC_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NUMERIC_LITERAL, 0); }
	public INTEGER_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.INTEGER_LITERAL, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprNumber) {
			listener.enterExprNumber(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprNumber) {
			listener.exitExprNumber(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprNumber) {
			return visitor.visitExprNumber(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprTimeContext extends LiteralContext {
	public dateLiteral(): DateLiteralContext {
		return this.getRuleContext(0, DateLiteralContext);
	}
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprTime) {
			listener.enterExprTime(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprTime) {
			listener.exitExprTime(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprTime) {
			return visitor.visitExprTime(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprNULLContext extends LiteralContext {
	public NULL(): TerminalNode { return this.getToken(MalloyParser.NULL, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprNULL) {
			listener.enterExprNULL(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprNULL) {
			listener.exitExprNULL(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprNULL) {
			return visitor.visitExprNULL(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprBoolContext extends LiteralContext {
	public TRUE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.TRUE, 0); }
	public FALSE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.FALSE, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprBool) {
			listener.enterExprBool(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprBool) {
			listener.exitExprBool(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprBool) {
			return visitor.visitExprBool(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprRegexContext extends LiteralContext {
	public HACKY_REGEX(): TerminalNode { return this.getToken(MalloyParser.HACKY_REGEX, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprRegex) {
			listener.enterExprRegex(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprRegex) {
			listener.exitExprRegex(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprRegex) {
			return visitor.visitExprRegex(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprNowContext extends LiteralContext {
	public NOW(): TerminalNode { return this.getToken(MalloyParser.NOW, 0); }
	constructor(ctx: LiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprNow) {
			listener.enterExprNow(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprNow) {
			listener.exitExprNow(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprNow) {
			return visitor.visitExprNow(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DateLiteralContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_dateLiteral; }
	public copyFrom(ctx: DateLiteralContext): void {
		super.copyFrom(ctx);
	}
}
export class LiteralTimestampContext extends DateLiteralContext {
	public LITERAL_TIMESTAMP(): TerminalNode { return this.getToken(MalloyParser.LITERAL_TIMESTAMP, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralTimestamp) {
			listener.enterLiteralTimestamp(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralTimestamp) {
			listener.exitLiteralTimestamp(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralTimestamp) {
			return visitor.visitLiteralTimestamp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralDayContext extends DateLiteralContext {
	public LITERAL_DAY(): TerminalNode { return this.getToken(MalloyParser.LITERAL_DAY, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralDay) {
			listener.enterLiteralDay(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralDay) {
			listener.exitLiteralDay(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralDay) {
			return visitor.visitLiteralDay(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralWeekContext extends DateLiteralContext {
	public LITERAL_WEEK(): TerminalNode { return this.getToken(MalloyParser.LITERAL_WEEK, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralWeek) {
			listener.enterLiteralWeek(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralWeek) {
			listener.exitLiteralWeek(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralWeek) {
			return visitor.visitLiteralWeek(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralMonthContext extends DateLiteralContext {
	public LITERAL_MONTH(): TerminalNode { return this.getToken(MalloyParser.LITERAL_MONTH, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralMonth) {
			listener.enterLiteralMonth(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralMonth) {
			listener.exitLiteralMonth(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralMonth) {
			return visitor.visitLiteralMonth(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralQuarterContext extends DateLiteralContext {
	public LITERAL_QUARTER(): TerminalNode { return this.getToken(MalloyParser.LITERAL_QUARTER, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralQuarter) {
			listener.enterLiteralQuarter(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralQuarter) {
			listener.exitLiteralQuarter(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralQuarter) {
			return visitor.visitLiteralQuarter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralYearContext extends DateLiteralContext {
	public LITERAL_YEAR(): TerminalNode { return this.getToken(MalloyParser.LITERAL_YEAR, 0); }
	constructor(ctx: DateLiteralContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterLiteralYear) {
			listener.enterLiteralYear(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitLiteralYear) {
			listener.exitLiteralYear(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitLiteralYear) {
			return visitor.visitLiteralYear(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TableNameContext extends ParserRuleContext {
	public STRING_LITERAL(): TerminalNode { return this.getToken(MalloyParser.STRING_LITERAL, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_tableName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTableName) {
			listener.enterTableName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTableName) {
			listener.exitTableName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTableName) {
			return visitor.visitTableName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IdContext extends ParserRuleContext {
	public IDENTIFIER(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.IDENTIFIER, 0); }
	public OBJECT_NAME_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.OBJECT_NAME_LITERAL, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_id; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterId) {
			listener.enterId(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitId) {
			listener.exitId(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitId) {
			return visitor.visitId(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TimeframeContext extends ParserRuleContext {
	public SECOND(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.SECOND, 0); }
	public MINUTE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MINUTE, 0); }
	public HOUR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.HOUR, 0); }
	public DAY(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DAY, 0); }
	public WEEK(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.WEEK, 0); }
	public MONTH(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MONTH, 0); }
	public QUARTER(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.QUARTER, 0); }
	public YEAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.YEAR, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_timeframe; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterTimeframe) {
			listener.enterTimeframe(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitTimeframe) {
			listener.exitTimeframe(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitTimeframe) {
			return visitor.visitTimeframe(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class UngroupContext extends ParserRuleContext {
	public ALL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.ALL, 0); }
	public EXCLUDE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.EXCLUDE, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_ungroup; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterUngroup) {
			listener.enterUngroup(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitUngroup) {
			listener.exitUngroup(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitUngroup) {
			return visitor.visitUngroup(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldExprContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldExpr; }
	public copyFrom(ctx: FieldExprContext): void {
		super.copyFrom(ctx);
	}
}
export class ExprFieldPathContext extends FieldExprContext {
	public fieldPath(): FieldPathContext {
		return this.getRuleContext(0, FieldPathContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprFieldPath) {
			listener.enterExprFieldPath(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprFieldPath) {
			listener.exitExprFieldPath(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprFieldPath) {
			return visitor.visitExprFieldPath(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprFilterContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public OCURLY(): TerminalNode { return this.getToken(MalloyParser.OCURLY, 0); }
	public filteredBy(): FilteredByContext {
		return this.getRuleContext(0, FilteredByContext);
	}
	public CCURLY(): TerminalNode { return this.getToken(MalloyParser.CCURLY, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprFilter) {
			listener.enterExprFilter(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprFilter) {
			listener.exitExprFilter(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprFilter) {
			return visitor.visitExprFilter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprLiteralContext extends FieldExprContext {
	public literal(): LiteralContext {
		return this.getRuleContext(0, LiteralContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprLiteral) {
			listener.enterExprLiteral(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprLiteral) {
			listener.exitExprLiteral(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprLiteral) {
			return visitor.visitExprLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprMinusContext extends FieldExprContext {
	public MINUS(): TerminalNode { return this.getToken(MalloyParser.MINUS, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprMinus) {
			listener.enterExprMinus(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprMinus) {
			listener.exitExprMinus(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprMinus) {
			return visitor.visitExprMinus(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprDurationContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public timeframe(): TimeframeContext {
		return this.getRuleContext(0, TimeframeContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprDuration) {
			listener.enterExprDuration(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprDuration) {
			listener.exitExprDuration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprDuration) {
			return visitor.visitExprDuration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprTimeTruncContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public DOT(): TerminalNode { return this.getToken(MalloyParser.DOT, 0); }
	public timeframe(): TimeframeContext {
		return this.getRuleContext(0, TimeframeContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprTimeTrunc) {
			listener.enterExprTimeTrunc(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprTimeTrunc) {
			listener.exitExprTimeTrunc(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprTimeTrunc) {
			return visitor.visitExprTimeTrunc(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprSafeCastContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public DOUBLECOLON(): TerminalNode { return this.getToken(MalloyParser.DOUBLECOLON, 0); }
	public malloyType(): MalloyTypeContext {
		return this.getRuleContext(0, MalloyTypeContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprSafeCast) {
			listener.enterExprSafeCast(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprSafeCast) {
			listener.exitExprSafeCast(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprSafeCast) {
			return visitor.visitExprSafeCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprMulDivContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public STAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STAR, 0); }
	public SLASH(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.SLASH, 0); }
	public PERCENT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.PERCENT, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprMulDiv) {
			listener.enterExprMulDiv(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprMulDiv) {
			listener.exitExprMulDiv(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprMulDiv) {
			return visitor.visitExprMulDiv(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprAddSubContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public PLUS(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.PLUS, 0); }
	public MINUS(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.MINUS, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprAddSub) {
			listener.enterExprAddSub(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprAddSub) {
			listener.exitExprAddSub(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprAddSub) {
			return visitor.visitExprAddSub(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprRangeContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public TO(): TerminalNode { return this.getToken(MalloyParser.TO, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprRange) {
			listener.enterExprRange(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprRange) {
			listener.exitExprRange(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprRange) {
			return visitor.visitExprRange(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprForRangeContext extends FieldExprContext {
	public _startAt!: FieldExprContext;
	public _duration!: FieldExprContext;
	public FOR(): TerminalNode { return this.getToken(MalloyParser.FOR, 0); }
	public timeframe(): TimeframeContext {
		return this.getRuleContext(0, TimeframeContext);
	}
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprForRange) {
			listener.enterExprForRange(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprForRange) {
			listener.exitExprForRange(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprForRange) {
			return visitor.visitExprForRange(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprLogicalTreeContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public partialAllowedFieldExpr(): PartialAllowedFieldExprContext {
		return this.getRuleContext(0, PartialAllowedFieldExprContext);
	}
	public AMPER(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.AMPER, 0); }
	public BAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.BAR, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprLogicalTree) {
			listener.enterExprLogicalTree(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprLogicalTree) {
			listener.exitExprLogicalTree(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprLogicalTree) {
			return visitor.visitExprLogicalTree(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprCompareContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public compareOp(): CompareOpContext {
		return this.getRuleContext(0, CompareOpContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprCompare) {
			listener.enterExprCompare(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprCompare) {
			listener.exitExprCompare(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprCompare) {
			return visitor.visitExprCompare(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprApplyContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public partialAllowedFieldExpr(): PartialAllowedFieldExprContext {
		return this.getRuleContext(0, PartialAllowedFieldExprContext);
	}
	public COLON(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.COLON, 0); }
	public QMARK(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.QMARK, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprApply) {
			listener.enterExprApply(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprApply) {
			listener.exitExprApply(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprApply) {
			return visitor.visitExprApply(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprNotContext extends FieldExprContext {
	public NOT(): TerminalNode { return this.getToken(MalloyParser.NOT, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprNot) {
			listener.enterExprNot(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprNot) {
			listener.exitExprNot(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprNot) {
			return visitor.visitExprNot(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprLogicalContext extends FieldExprContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public AND(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.AND, 0); }
	public OR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.OR, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprLogical) {
			listener.enterExprLogical(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprLogical) {
			listener.exitExprLogical(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprLogical) {
			return visitor.visitExprLogical(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprCastContext extends FieldExprContext {
	public CAST(): TerminalNode { return this.getToken(MalloyParser.CAST, 0); }
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public AS(): TerminalNode { return this.getToken(MalloyParser.AS, 0); }
	public malloyType(): MalloyTypeContext {
		return this.getRuleContext(0, MalloyTypeContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprCast) {
			listener.enterExprCast(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprCast) {
			listener.exitExprCast(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprCast) {
			return visitor.visitExprCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprCountDisinctContext extends FieldExprContext {
	public COUNT(): TerminalNode { return this.getToken(MalloyParser.COUNT, 0); }
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public DISTINCT(): TerminalNode { return this.getToken(MalloyParser.DISTINCT, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprCountDisinct) {
			listener.enterExprCountDisinct(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprCountDisinct) {
			listener.exitExprCountDisinct(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprCountDisinct) {
			return visitor.visitExprCountDisinct(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprAggregateContext extends FieldExprContext {
	public aggregate(): AggregateContext {
		return this.getRuleContext(0, AggregateContext);
	}
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	public fieldPath(): FieldPathContext | undefined {
		return this.tryGetRuleContext(0, FieldPathContext);
	}
	public DOT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DOT, 0); }
	public fieldExpr(): FieldExprContext | undefined {
		return this.tryGetRuleContext(0, FieldExprContext);
	}
	public STAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STAR, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprAggregate) {
			listener.enterExprAggregate(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprAggregate) {
			listener.exitExprAggregate(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprAggregate) {
			return visitor.visitExprAggregate(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprExprContext extends FieldExprContext {
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public partialAllowedFieldExpr(): PartialAllowedFieldExprContext {
		return this.getRuleContext(0, PartialAllowedFieldExprContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprExpr) {
			listener.enterExprExpr(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprExpr) {
			listener.exitExprExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprExpr) {
			return visitor.visitExprExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprFuncContext extends FieldExprContext {
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	public id(): IdContext | undefined {
		return this.tryGetRuleContext(0, IdContext);
	}
	public timeframe(): TimeframeContext | undefined {
		return this.tryGetRuleContext(0, TimeframeContext);
	}
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprFunc) {
			listener.enterExprFunc(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprFunc) {
			listener.exitExprFunc(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprFunc) {
			return visitor.visitExprFunc(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprPickContext extends FieldExprContext {
	public pickStatement(): PickStatementContext {
		return this.getRuleContext(0, PickStatementContext);
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprPick) {
			listener.enterExprPick(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprPick) {
			listener.exitExprPick(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprPick) {
			return visitor.visitExprPick(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ExprUngroupContext extends FieldExprContext {
	public ungroup(): UngroupContext {
		return this.getRuleContext(0, UngroupContext);
	}
	public OPAREN(): TerminalNode { return this.getToken(MalloyParser.OPAREN, 0); }
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public CPAREN(): TerminalNode { return this.getToken(MalloyParser.CPAREN, 0); }
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	public fieldName(): FieldNameContext[];
	public fieldName(i: number): FieldNameContext;
	public fieldName(i?: number): FieldNameContext | FieldNameContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldNameContext);
		} else {
			return this.getRuleContext(i, FieldNameContext);
		}
	}
	constructor(ctx: FieldExprContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterExprUngroup) {
			listener.enterExprUngroup(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitExprUngroup) {
			listener.exitExprUngroup(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitExprUngroup) {
			return visitor.visitExprUngroup(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PartialAllowedFieldExprContext extends ParserRuleContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public compareOp(): CompareOpContext | undefined {
		return this.tryGetRuleContext(0, CompareOpContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_partialAllowedFieldExpr; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterPartialAllowedFieldExpr) {
			listener.enterPartialAllowedFieldExpr(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitPartialAllowedFieldExpr) {
			listener.exitPartialAllowedFieldExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitPartialAllowedFieldExpr) {
			return visitor.visitPartialAllowedFieldExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PickStatementContext extends ParserRuleContext {
	public _pickElse!: FieldExprContext;
	public pick(): PickContext[];
	public pick(i: number): PickContext;
	public pick(i?: number): PickContext | PickContext[] {
		if (i === undefined) {
			return this.getRuleContexts(PickContext);
		} else {
			return this.getRuleContext(i, PickContext);
		}
	}
	public ELSE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.ELSE, 0); }
	public fieldExpr(): FieldExprContext | undefined {
		return this.tryGetRuleContext(0, FieldExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_pickStatement; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterPickStatement) {
			listener.enterPickStatement(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitPickStatement) {
			listener.exitPickStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitPickStatement) {
			return visitor.visitPickStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PickContext extends ParserRuleContext {
	public _pickValue!: FieldExprContext;
	public _pickWhen!: PartialAllowedFieldExprContext;
	public PICK(): TerminalNode { return this.getToken(MalloyParser.PICK, 0); }
	public WHEN(): TerminalNode { return this.getToken(MalloyParser.WHEN, 0); }
	public partialAllowedFieldExpr(): PartialAllowedFieldExprContext {
		return this.getRuleContext(0, PartialAllowedFieldExprContext);
	}
	public fieldExpr(): FieldExprContext | undefined {
		return this.tryGetRuleContext(0, FieldExprContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_pick; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterPick) {
			listener.enterPick(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitPick) {
			listener.exitPick(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitPick) {
			return visitor.visitPick(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArgumentListContext extends ParserRuleContext {
	public fieldExpr(): FieldExprContext[];
	public fieldExpr(i: number): FieldExprContext;
	public fieldExpr(i?: number): FieldExprContext | FieldExprContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldExprContext);
		} else {
			return this.getRuleContext(i, FieldExprContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_argumentList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterArgumentList) {
			listener.enterArgumentList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitArgumentList) {
			listener.exitArgumentList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitArgumentList) {
			return visitor.visitArgumentList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldNameListContext extends ParserRuleContext {
	public fieldName(): FieldNameContext[];
	public fieldName(i: number): FieldNameContext;
	public fieldName(i?: number): FieldNameContext | FieldNameContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldNameContext);
		} else {
			return this.getRuleContext(i, FieldNameContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldNameList; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldNameList) {
			listener.enterFieldNameList(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldNameList) {
			listener.exitFieldNameList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldNameList) {
			return visitor.visitFieldNameList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldCollectionContext extends ParserRuleContext {
	public collectionMember(): CollectionMemberContext[];
	public collectionMember(i: number): CollectionMemberContext;
	public collectionMember(i?: number): CollectionMemberContext | CollectionMemberContext[] {
		if (i === undefined) {
			return this.getRuleContexts(CollectionMemberContext);
		} else {
			return this.getRuleContext(i, CollectionMemberContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldCollection; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldCollection) {
			listener.enterFieldCollection(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldCollection) {
			listener.exitFieldCollection(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldCollection) {
			return visitor.visitFieldCollection(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class CollectionMemberContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_collectionMember; }
	public copyFrom(ctx: CollectionMemberContext): void {
		super.copyFrom(ctx);
	}
}
export class NameMemberContext extends CollectionMemberContext {
	public fieldPath(): FieldPathContext {
		return this.getRuleContext(0, FieldPathContext);
	}
	constructor(ctx: CollectionMemberContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNameMember) {
			listener.enterNameMember(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNameMember) {
			listener.exitNameMember(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNameMember) {
			return visitor.visitNameMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class WildMemberContext extends CollectionMemberContext {
	public STAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STAR, 0); }
	public STARSTAR(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.STARSTAR, 0); }
	public fieldPath(): FieldPathContext | undefined {
		return this.tryGetRuleContext(0, FieldPathContext);
	}
	public DOT(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.DOT, 0); }
	constructor(ctx: CollectionMemberContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterWildMember) {
			listener.enterWildMember(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitWildMember) {
			listener.exitWildMember(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitWildMember) {
			return visitor.visitWildMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NewMemberContext extends CollectionMemberContext {
	public fieldDef(): FieldDefContext {
		return this.getRuleContext(0, FieldDefContext);
	}
	constructor(ctx: CollectionMemberContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNewMember) {
			listener.enterNewMember(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNewMember) {
			listener.exitNewMember(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNewMember) {
			return visitor.visitNewMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldPathContext extends ParserRuleContext {
	public fieldName(): FieldNameContext[];
	public fieldName(i: number): FieldNameContext;
	public fieldName(i?: number): FieldNameContext | FieldNameContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FieldNameContext);
		} else {
			return this.getRuleContext(i, FieldNameContext);
		}
	}
	public DOT(): TerminalNode[];
	public DOT(i: number): TerminalNode;
	public DOT(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.DOT);
		} else {
			return this.getToken(MalloyParser.DOT, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldPath; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldPath) {
			listener.enterFieldPath(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldPath) {
			listener.exitFieldPath(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldPath) {
			return visitor.visitFieldPath(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JoinNameContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_joinName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJoinName) {
			listener.enterJoinName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJoinName) {
			listener.exitJoinName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJoinName) {
			return visitor.visitJoinName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FieldNameContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_fieldName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterFieldName) {
			listener.enterFieldName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitFieldName) {
			listener.exitFieldName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitFieldName) {
			return visitor.visitFieldName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JustExprContext extends ParserRuleContext {
	public fieldExpr(): FieldExprContext {
		return this.getRuleContext(0, FieldExprContext);
	}
	public EOF(): TerminalNode { return this.getToken(MalloyParser.EOF, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_justExpr; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJustExpr) {
			listener.enterJustExpr(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJustExpr) {
			listener.exitJustExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJustExpr) {
			return visitor.visitJustExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JsonContext extends ParserRuleContext {
	public jsonValue(): JsonValueContext {
		return this.getRuleContext(0, JsonValueContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_json; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJson) {
			listener.enterJson(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJson) {
			listener.exitJson(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJson) {
			return visitor.visitJson(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JsonValueContext extends ParserRuleContext {
	public JSON_STRING(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.JSON_STRING, 0); }
	public INTEGER_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.INTEGER_LITERAL, 0); }
	public NUMERIC_LITERAL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NUMERIC_LITERAL, 0); }
	public jsonObject(): JsonObjectContext | undefined {
		return this.tryGetRuleContext(0, JsonObjectContext);
	}
	public jsonArray(): JsonArrayContext | undefined {
		return this.tryGetRuleContext(0, JsonArrayContext);
	}
	public TRUE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.TRUE, 0); }
	public FALSE(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.FALSE, 0); }
	public NULL(): TerminalNode | undefined { return this.tryGetToken(MalloyParser.NULL, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_jsonValue; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJsonValue) {
			listener.enterJsonValue(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJsonValue) {
			listener.exitJsonValue(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJsonValue) {
			return visitor.visitJsonValue(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JsonObjectContext extends ParserRuleContext {
	public OCURLY(): TerminalNode { return this.getToken(MalloyParser.OCURLY, 0); }
	public jsonProperty(): JsonPropertyContext[];
	public jsonProperty(i: number): JsonPropertyContext;
	public jsonProperty(i?: number): JsonPropertyContext | JsonPropertyContext[] {
		if (i === undefined) {
			return this.getRuleContexts(JsonPropertyContext);
		} else {
			return this.getRuleContext(i, JsonPropertyContext);
		}
	}
	public CCURLY(): TerminalNode { return this.getToken(MalloyParser.CCURLY, 0); }
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_jsonObject; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJsonObject) {
			listener.enterJsonObject(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJsonObject) {
			listener.exitJsonObject(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJsonObject) {
			return visitor.visitJsonObject(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JsonPropertyContext extends ParserRuleContext {
	public JSON_STRING(): TerminalNode { return this.getToken(MalloyParser.JSON_STRING, 0); }
	public COLON(): TerminalNode { return this.getToken(MalloyParser.COLON, 0); }
	public jsonValue(): JsonValueContext {
		return this.getRuleContext(0, JsonValueContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_jsonProperty; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJsonProperty) {
			listener.enterJsonProperty(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJsonProperty) {
			listener.exitJsonProperty(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJsonProperty) {
			return visitor.visitJsonProperty(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class JsonArrayContext extends ParserRuleContext {
	public OBRACK(): TerminalNode { return this.getToken(MalloyParser.OBRACK, 0); }
	public jsonValue(): JsonValueContext[];
	public jsonValue(i: number): JsonValueContext;
	public jsonValue(i?: number): JsonValueContext | JsonValueContext[] {
		if (i === undefined) {
			return this.getRuleContexts(JsonValueContext);
		} else {
			return this.getRuleContext(i, JsonValueContext);
		}
	}
	public CBRACK(): TerminalNode { return this.getToken(MalloyParser.CBRACK, 0); }
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(MalloyParser.COMMA);
		} else {
			return this.getToken(MalloyParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_jsonArray; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterJsonArray) {
			listener.enterJsonArray(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitJsonArray) {
			listener.exitJsonArray(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitJsonArray) {
			return visitor.visitJsonArray(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class SqlExploreNameRefContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_sqlExploreNameRef; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterSqlExploreNameRef) {
			listener.enterSqlExploreNameRef(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitSqlExploreNameRef) {
			listener.exitSqlExploreNameRef(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitSqlExploreNameRef) {
			return visitor.visitSqlExploreNameRef(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NameSQLBlockContext extends ParserRuleContext {
	public id(): IdContext {
		return this.getRuleContext(0, IdContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_nameSQLBlock; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterNameSQLBlock) {
			listener.enterNameSQLBlock(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitNameSQLBlock) {
			listener.exitNameSQLBlock(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitNameSQLBlock) {
			return visitor.visitNameSQLBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConnectionNameContext extends ParserRuleContext {
	public JSON_STRING(): TerminalNode { return this.getToken(MalloyParser.JSON_STRING, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return MalloyParser.RULE_connectionName; }
	// @Override
	public enterRule(listener: MalloyParserListener): void {
		if (listener.enterConnectionName) {
			listener.enterConnectionName(this);
		}
	}
	// @Override
	public exitRule(listener: MalloyParserListener): void {
		if (listener.exitConnectionName) {
			listener.exitConnectionName(this);
		}
	}
	// @Override
	public accept<Result>(visitor: MalloyParserVisitor<Result>): Result {
		if (visitor.visitConnectionName) {
			return visitor.visitConnectionName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}



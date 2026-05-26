let itemProperties = [],
	currentItemProperty = {},
	currentItemPropertyEnable = 0,
	propsValidationRowCounter = 1,
	propsHiddenRowCounter = 1,
	propsFormatRowCounter = 1,
	propsCurrentItemKey = "";

function mappingformuladatafunc(itemKey, itemName, linkedItems) {
	propsCurrentItemKey = itemKey;
	if (currentItemPropertyEnable == 1) {
		let itemProperty = {},
			display = {},
			visibility = {},
			validation = {},
			format = {},
			itemPropertyKey = '',
			validationAdditonalRules = [],
			formatAdditonalRules = [];

		itemProperty = currentItemProperty;

		display.value = $('#mapping-formula-props #props-display-value').val();
		display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
		display.global = $('#mapping-formula-props #props-display-global-variable-name').val();
		itemProperty['display'] = display;

		visibility.hiddenWhenEmpty = $("#mapping-formula-props #props-is-hidden-empty option:selected").val();
		var hiddenRules = [];
		$("#prop-hidden-rules-table").find('tbody tr').each(function (i) {
			var hiddenRule = {};
			var $fieldset = $(this);
			hiddenRule.logical = $('select:eq(0) option:selected', $fieldset).val();
			hiddenRule.original = $('input:text:eq(0)', $fieldset).val();
			hiddenRule.operations = $('select:eq(1) option:selected', $fieldset).val();
			hiddenRule.column = $('input:text:eq(1)', $fieldset).val();
			hiddenRules.push(hiddenRule);
		});
		visibility.hidden_rules = hiddenRules;
		itemProperty["visibility"] = visibility;

		validation.isRequired = $('#mapping-formula-props #props-validation-is-required').val();
		validation.valueMustbe = $('#mapping-formula-props #props-validation-value-must-be').val();

		$('#prop-validation-additional-rules-table').find('tbody tr').each(function (i) {
			let validationAdditonalRule = {};
			let $fieldset = $(this);
			validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
			validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
			validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
			validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
			validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
			validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
			validationAdditonalRules.push(validationAdditonalRule);
		});

		validation.additonal_rules = validationAdditonalRules;
		itemProperty['validation'] = validation;

		format.trim = $('#mapping-formula-props #props-format-is-trim').val();
		format.enableRounding = $('#mapping-formula-props #props-format-enable-rounding').val();
		format.enabeDecimal = $('#mapping-formula-props #props-format-enable-decimal').val();
		format.decimal = $('#mapping-formula-props #props-format-decimal').val();

		$('#prop-format-additional-rules-table').find('tbody tr').each(function (i) {
			let formatAdditonalRule = {};
			let $fieldset = $(this);
			formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

			if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
				formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
			} else {
				formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
			}

			if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING' || formatAdditonalRule.name == 'To DATE') {
				formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
			} else {
				formatAdditonalRule.formulatonew = '';
			}

			formatAdditonalRules.push(formatAdditonalRule);
		});

		format.additonal_rules = formatAdditonalRules;
		itemProperty['format'] = format;

		itemPropertyKey = itemProperty.general.itemKey;

		if (itemProperties.length > 0) {
			for (let i = 0; i < itemProperties.length; i++) {
				if (itemProperties[i].general.itemKey == itemPropertyKey) {
					itemProperties[i] = itemProperty;
					itemPropertyKey = '';
				}
			}
		}

		if (itemPropertyKey != '') {
			itemProperties.push(itemProperty);
		}
	}

	let general = {};
	general.itemName = itemName;
	general.itemKey = itemKey;

	currentItemProperty = {};
	currentItemProperty['general'] = general;
	currentItemProperty['linkedItems'] = linkedItems;

	let linkedItemsRows = '';
	for (let i = 0; i < linkedItems.length; i++) {
		if (linkedItems[i].itemKey != undefined && linkedItems[i].itemName != undefined) {
			linkedItemsRows += '<tr class="table-section-linked-items-rows">';
			linkedItemsRows += '<td style="word-break: break-all;">';
			linkedItemsRows += linkedItems[i].itemKey;
			linkedItemsRows += '</td>';
			linkedItemsRows += '<td>';
			linkedItemsRows += linkedItems[i].itemName;
			linkedItemsRows += '</td>';
			linkedItemsRows += '</tr>';
		}
	}

	var displayValue = `=${currentItemProperty.general.itemKey}`,
		displaydefaultValue = '',
		displayglobalValue = '',
		validationIsRequired = 'FALSE',
		visibilityHiddenWhenEmpty = 'FALSE',
		validationValueMustbe = '',
		formatTrim = 'FALSE',
		formatEnableRounding = 'FALSE',
		formatEnabeDecimal = 'FALSE',
		formatDecimal = 2,
		propValidationAdditionalRulesTr = '',
		propFormatAdditionalRulesTr = '',
		propHiddenRulesTr = '';

	if (itemProperties.length > 0) {
		for (let i = 0; i < itemProperties.length; i++) {
			if (itemProperties[i].general.itemKey == itemKey) {
				const itemFormatAdditionalRules = itemProperties[i].format.additonal_rules;

				displayValue = itemProperties[i].display.value;
				displaydefaultValue = itemProperties[i].display.defaultValue;
				displayglobalValue = itemProperties[i].display.global;
				validationIsRequired = itemProperties[i].validation.isRequired;
				validationValueMustbe = itemProperties[i].validation.valueMustbe;
				visibilityHiddenWhenEmpty = itemProperties[i]?.visibility?.hiddenWhenEmpty || "FALSE";

				if (itemProperties[i].validation.additonal_rules != undefined) {
					const propValidationAdditonalRules = itemProperties[i].validation.additonal_rules;
					for (let j = 0; j < propValidationAdditonalRules.length; j++) {
						propValidationAdditionalRulesTr += '<tr><td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND"';

						if (propValidationAdditonalRules[j].logical == 'AND') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>AND</option><option value="OR"';
						if (propValidationAdditonalRules[j].logical == 'OR') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>OR</option>';
						propValidationAdditionalRulesTr += '</select></td><td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformula" id="proporiginal_' + j + '" value="' + propValidationAdditonalRules[j].original.replace(/"/g, '&quot;') + '"/></td><td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="=="';

						if (propValidationAdditonalRules[j].operations == '==') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>=</option><option value=">"';
						if (propValidationAdditonalRules[j].operations == '>') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>></option><option value=">="';
						if (propValidationAdditonalRules[j].operations == '>=') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>>=</option><option value="<"';
						if (propValidationAdditonalRules[j].operations == '<') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '><</option><option value="<="';
						if (propValidationAdditonalRules[j].operations == '<=') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '><=</option><option value="<>"';
						if (propValidationAdditonalRules[j].operations == '<>') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '><></option><option value="Contains"';
						if (propValidationAdditonalRules[j].operations == 'Contains') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>Contains</option></select></td><td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformula" id="propcolumn_' + j + '" value="' + propValidationAdditonalRules[j].column.replace(/"/g, '&quot;') + '"/></td><td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][then]"><option value="STOP"';

						if (propValidationAdditonalRules[j].then == 'STOP') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>STOP</option>';
						propValidationAdditionalRulesTr += '</select></td><td class="col-sm-2"><input type="text" name="propsvalidations[][formula]" class="form-control border-0 autocompleteformula" id="propformula_' + j + '" value="' + propValidationAdditonalRules[j].formula.replace(/"/g, '&quot;') + '"/></td><td class="col-sm-2"><a href="javascript:void(0);" type="button" class="prop-validation-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td></tr>';
					}

					propsValidationRowCounter = propValidationAdditonalRules.length;
				}

				if (itemProperties[i]?.visibility?.hidden_rules != undefined) {
					var propHiddenRules = itemProperties[i]?.visibility?.hidden_rules;
					for (var j = 0; j < propHiddenRules.length; j++) {
						propHiddenRulesTr += '<tr><td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND"';

						if (propHiddenRules[j].logical == 'AND') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>AND</option><option value="OR"';
						if (propHiddenRules[j].logical == 'OR') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>OR</option>';
						propHiddenRulesTr += '</select></td><td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformula" id="prophiddenoriginal_' + j + '" value="' + propHiddenRules[j].original.replace(/"/g, '&quot;') + '"/></td><td class="col-sm-2 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="=="';

						if (propHiddenRules[j].operations == '==') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>=</option><option value=">"';
						if (propHiddenRules[j].operations == '>') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>></option><option value=">="';
						if (propHiddenRules[j].operations == '>=') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>>=</option><option value="<"';
						if (propHiddenRules[j].operations == '<') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '><</option><option value="<="';
						if (propHiddenRules[j].operations == '<=') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '><=</option><option value="<>"';
						if (propHiddenRules[j].operations == '<>') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '><></option><option value="Contains"';
						if (propHiddenRules[j].operations == 'Contains') {
							propHiddenRulesTr += ' selected';
						}

						propHiddenRulesTr += '>Contains</option></select></td><td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformula" id="prophiddencolumn_' + j + '" value="' + propHiddenRules[j].column.replace(/"/g, '&quot;') + '"/><td class="col-sm-2" style="text-align: -webkit-center;"><a href="javascript:void(0);" type="button" class="prop-hidden-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td></tr>';
					}

					propsHiddenRowCounter = propHiddenRules.length;
				}

				formatTrim = itemProperties[i].format.trim;
				formatEnableRounding = itemProperties[i].format.enableRounding;
				formatEnabeDecimal = itemProperties[i].format.enabeDecimal;
				formatDecimal = itemProperties[i].format.decimal;

				if (itemFormatAdditionalRules != undefined) {
					const propFormatAdditonalRules = itemFormatAdditionalRules;
					for (let l = 0; l < propFormatAdditonalRules.length; l++) {
						propFormatAdditionalRulesTr += '<tr id="prop-format-additional-rules-table-row-' + l + '">';
						propFormatAdditionalRulesTr += '<td class="col-sm-1 format-rules-icon text-center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';

						propFormatAdditionalRulesTr += '<td class="col-sm-3"><select class="select-dropdown form-control form-control-lg format-additional-rules-name" name="formatrules[][name]" id="format-additional-rules-name-' + l + '"><option value="REPLACE"';

						if (propFormatAdditonalRules[l].name == 'REPLACE') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>REPLACE</option><option value="SUBSTRING"';
						if (propFormatAdditonalRules[l].name == 'SUBSTRING') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>SUBSTRING</option><option value="To DATE"';
						if (propFormatAdditonalRules[l].name == 'To DATE') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>To DATE</option><option value="TRIM"';
						if (propFormatAdditonalRules[l].name == 'TRIM') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>TRIM</option><option value="LEFT TRIM"';
						if (propFormatAdditonalRules[l].name == 'LEFT TRIM') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>LEFT TRIM</option><option value="RIGHT TRIM"';
						if (propFormatAdditonalRules[l].name == 'RIGHT TRIM') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>RIGHT TRIM</option><option value="ADD WORDS ON THE BEGINING"';
						if (propFormatAdditonalRules[l].name == 'ADD WORDS ON THE BEGINING') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>ADD WORDS ON THE BEGINING</option><option value="ADD WORDS ON THE END"';
						if (propFormatAdditonalRules[l].name == 'ADD WORDS ON THE END') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>ADD WORDS ON THE END</option><option value="FORMULA TO"';
						if (propFormatAdditonalRules[l].name == 'FORMULA TO') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>FORMULA TO</option></select></td>';

						propFormatAdditionalRulesTr += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulato autocomplete">';
						propFormatAdditionalRulesTr += "<input type='text' name='formatrules[][formulato]' class='form-control border-0 autocompleteformula' id='format-additional-rules-formulato-" + l + "' value='" + propFormatAdditonalRules[l].formulato.replace(/'/g, '&apos;') + "' ";

						if (propFormatAdditonalRules[l].name == 'TRIM' || propFormatAdditonalRules[l].name == 'LEFT TRIM' || propFormatAdditonalRules[l].name == 'RIGHT TRIM') {
							propFormatAdditionalRulesTr += 'style="display: none;"';
						} else { }

						propFormatAdditionalRulesTr += '/>';
						propFormatAdditionalRulesTr += '<select class="select-dropdown form-control form-control-lg" name="formatrules[][formulatodropdown]" id="format-additional-rules-formulatodropdown-' + l + '" ';

						if (propFormatAdditonalRules[l].name == 'TRIM' || propFormatAdditonalRules[l].name == 'LEFT TRIM' || propFormatAdditonalRules[l].name == 'RIGHT TRIM') { } else {
							propFormatAdditionalRulesTr += 'style="display: none;"';
						}

						propFormatAdditionalRulesTr += '><option value="FALSE"';
						if (propFormatAdditonalRules[l].formulato == 'FALSE') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>FALSE</option><option value="TRUE"';
						if (propFormatAdditonalRules[l].formulato == 'TRUE') {
							propFormatAdditionalRulesTr += ' selected';
						}

						propFormatAdditionalRulesTr += '>TRUE</option></select>';
						propFormatAdditionalRulesTr += '</td>';

						propFormatAdditionalRulesTr += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulatonew">';

						if (propFormatAdditonalRules[l].name == 'REPLACE' || propFormatAdditonalRules[l].name == 'SUBSTRING' || propFormatAdditonalRules[l].name == 'To DATE') {
							propFormatAdditionalRulesTr += "<input type='text' name='formatrules[][formulatonew]' class='form-control border-0' id='format-additional-rules-formulatonew-" + l + "' value='" + propFormatAdditonalRules[l].formulatonew.replace(/'/g, '&apos;') + "'/>";
						}

						propFormatAdditionalRulesTr += '</td>';
						propFormatAdditionalRulesTr += '<td class="col-sm-1"><a href="javascript:void(0);" type="button" class="prop-format-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
						propFormatAdditionalRulesTr += '</tr>';
					}

					propsFormatRowCounter = propFormatAdditonalRules.length;
				}
			}
		}
	}

	$('#mapping-formula-props #props-general-item').html(itemName);
	$('#mapping-formula-props .table-section-linked-items-rows').remove();
	$('#mapping-formula-props #table-section-linked-items-row').after(linkedItemsRows);
	$('#mapping-formula-props #props-display-value').val(displayValue);
	$('#mapping-formula-props #props-display-default-value').val(displaydefaultValue);
	$('#mapping-formula-props #props-display-global-variable-name').val(displayglobalValue);
	$('#mapping-formula-props #props-is-hidden-empty > option[value="' + visibilityHiddenWhenEmpty + '"]').attr('selected', 'selected').prop('selected', true);

	$("table.prop-hidden-rules-table tbody").html(propHiddenRulesTr);
	if (propHiddenRulesTr == '') {
		$('#prop-hidden-rules-btn-add-row').trigger('click');
	}

	$('#props-validation-is-required').val(validationIsRequired).trigger('change');
	$('#props-validation-value-must-be').val(validationValueMustbe).trigger('change');

	$('table.prop-validation-additional-rules-table tbody').html(propValidationAdditionalRulesTr);
	if (propValidationAdditionalRulesTr == '') {
		$('#prop-validation-additional-rules-btn-add-row').trigger('click');
	}

	$('#props-format-is-trim').val(formatTrim).trigger('change');
	$('#props-format-enable-rounding').val(formatEnableRounding).trigger('change');
	$('#props-format-enable-decimal').val(formatEnabeDecimal).trigger('change');

	$('#mapping-formula-props #props-format-decimal').val(formatDecimal);

	$('table.prop-format-additional-rules-table tbody').html(propFormatAdditionalRulesTr);
	if (propFormatAdditionalRulesTr == '') {
		$('#prop-format-additional-rules-btn-add-row').trigger('click');
	}

	currentItemPropertyEnable = 1;
}

// Godmark : this is GOJS default sample code
// Use a TreeNode so that when a node is not visible because a parent is collapsed,
// connected links seem to be connected with the lowest visible parent node.
// This also forces other links connecting with nodes in the group to be rerouted,
// because collapsing/expanding nodes will cause many nodes to move and to appear or disappear.
class TreeNode extends go.Node {
	constructor() {
		super();
		this.treeExpandedChanged = node => {
			if (node.containingGroup !== null) {
				node.containingGroup.findExternalLinksConnected().each(l => l.invalidateRoute());
			}
		};
	}

	findVisibleNode() {
		// redirect links to lowest visible "ancestor" in the tree
		let n = this;
		while (n !== null && !n.isVisible()) {
			n = n.findTreeParentNode();
		}
		return n;
	}
}
// end TreeNode

// Godmark : this is GOJS to control the layout type , you can review the example in https://gojs.net/latest/samples/treeMapper.html , there have ToGroup , Normal , ToNode 3 options there
// Control how Mapping links are routed:
// - "Normal": normal routing with fixed fromEndSegmentLength & toEndSegmentLength
// - "ToGroup": so that the link routes stop at the edge of the group,
//		rather than going all the way to the connected nodes
// - "ToNode": so that they go all the way to the connected nodes
//		but only bend at the edge of the group
let ROUTINGSTYLE = 'ToGroup';

// Godmark : MappingLink Class
// If you want the regular routing where the Link.[from/to]EndSegmentLength controls
// the length of the horizontal segment adjacent to the port, don't use this class.
// Replace MappingLink with a go.Link in the "Mapping" link template.
class MappingLink extends go.Link {
	getLinkPoint(node, port, spot, from, ortho, othernode, otherport) {
		if (ROUTINGSTYLE !== 'ToGroup') {
			return super.getLinkPoint(node, port, spot, from, ortho, othernode, otherport);
		} else {
			const r = port.getDocumentBounds();
			const group = node.containingGroup;
			const b = (group !== null) ? group.actualBounds : node.actualBounds;
			const op = othernode.getDocumentPoint(go.Spot.Center);
			const x = (op.x > r.centerX) ? b.right : b.left;
			return new go.Point(x, r.centerY);
		}
	}

	computePoints() {
		const result = super.computePoints();
		if (result && ROUTINGSTYLE === 'ToNode') {
			const fn = this.fromNode;
			const tn = this.toNode;
			if (fn && tn) {
				const fg = fn.containingGroup;
				const fb = fg ? fg.actualBounds : fn.actualBounds;
				const fpt = this.getPoint(0);
				const tg = tn.containingGroup;
				const tb = tg ? tg.actualBounds : tn.actualBounds;
				const tpt = this.getPoint(this.pointsCount - 1);
				this.setPoint(1, new go.Point((fpt.x < tpt.x) ? fb.right : fb.left, fpt.y));
				this.setPoint(this.pointsCount - 2, new go.Point((fpt.x < tpt.x) ? tb.left : tb.right, tpt.y));
			}
		}
		return result;
	}
}
// end MappingLink

// Godmark : nodeDataArray is data for control Left and Right Box UI Display
let nodeDataArray = [];
// Godmark : linkDataArray is data for control the relationship , we can make it empty as this moment
let linkDataArray = [];

let CurrentModel = null;
function init() {
	// Since 2.2 you can also author concise templates with method chaining instead of GraphObject.make
	// For details, see https://gojs.net/latest/intro/buildingObjects.html
	const $ = go.GraphObject.make; // for conciseness in defining templates
	//Godmark : after drag & drop event make some relationship , can trigger the GOJS mapping reuslt into some textbox
	myDiagram =
		$(go.Diagram, 'myDiagramDiv',
			{
				'commandHandler.copiesTree': true,
				'commandHandler.deletesTree': true,
				// newly drawn links always map a node in one tree to a node in another tree
				'linkingTool.archetypeLinkData': { category: 'Mapping' },
				'linkingTool.linkValidation': checkLink,
				'relinkingTool.linkValidation': checkLink,
				'undoManager.isEnabled': true,
				'ModelChanged': e => {
					if (e.isTransactionFinished) { // show the model data in the page's TextArea
						document.getElementById('mySavedModel').textContent = e.model.toJson();
						document.getElementById('mySavedModel2').value = e.model.toJson();
						CurrentModel = e.model;
					}
				}
			});

	// Godmark : some link control
	// All links must go from a node inside the "Left Side" Group to a node inside the "Right Side" Group.
	function checkLink(fn, fp, tn, tp, link) {
		// make sure the nodes are inside different Groups
		if (fn.containingGroup === null || fn.containingGroup.data.key !== 'inbound') return false;
		if (tn.containingGroup === null || tn.containingGroup.data.key !== 'outbound') return false;

		// fn = Inbound Column
		if (fn.data.type == 'object') {
			// tn = Outbound Column
			if (tn.data.type == 'integer' || tn.data.type == 'number' || tn.data.type == 'boolean') return false;
		}

		// // fn = Inbound Column
		// if (fn.data.type == 'string') {
		// 	// tn = Outbound Column
		// 	if (tn.data.type == 'integer' || tn.data.type == 'number' || tn.data.type == 'boolean') return false;
		// }

		// fn = Inbound Column
		if (fn.data.type == 'array') {
			// tn = Outbound Column
			if (tn.data.type == 'object' || tn.data.type == 'integer' || tn.data.type == 'number' || tn.data.type == 'boolean') return false;
		}
		//// optional limit to a single mapping link per node
		if (tn.linksConnected.any(l => l.category === 'Mapping') && tn.data.type != 'array') return false;
		//if (fn.linksConnected.any(l => l.category === 'Mapping')) return false;
		//if (tn.linksConnected.any(l => l.category === 'Mapping')) return false;
		return true;
	}

	function onSelectionChanged(node) {
		if (node.isSelected) {
			// Try to open properties here
			// console.log(node.data);
			const itemKey = node.data.key;
			const itemName = node.data.text;
			const itemGroup = node.data.group;
			// console.log(node.linksConnected);
			const linksConnected = node.linksConnected;
			let linkedItems = [];
			while (linksConnected.next()) {
				// console.log(linksConnected.value);
				let linkedItem = {};
				if (itemGroup == 'outbound') {
					if (itemGroup != linksConnected.value.fromNode.data.group) {
						// console.log(linksConnected.value.fromNode.data);
						const linkedItemKey = linksConnected.value.fromNode.data.key;
						const linkedItemText = linksConnected.value.fromNode.data.text;
						linkedItem['itemName'] = linkedItemText;
						linkedItem['itemKey'] = linkedItemKey;
					}
				} else {
					if (itemGroup != linksConnected.value.toNode.data.group) {
						// console.log(linksConnected.value.toNode.data);
						const linkedItemKey = linksConnected.value.toNode.data.key;
						const linkedItemText = linksConnected.value.toNode.data.text;
						linkedItem['itemName'] = linkedItemText;
						linkedItem['itemKey'] = linkedItemKey;
					}
				}
				linkedItems.push(linkedItem);
			}
			mappingformuladatafunc(itemKey, itemName, linkedItems);
		}
	}

	// Godmark : some GOJS event setting , if you want the display name on the UI Box show "text" or another variable from nodeDataArray , can be setup here , e.g. $(go.TextBlock, new go.Binding("text",))
	// Each node in a tree is defined using the default nodeTemplate.
	myDiagram.nodeTemplate =
		$(TreeNode,
			{ movable: false, copyable: false, deletable: false }, // user cannot move an individual node
			// no Adornment: instead change panel background color by binding to Node.isSelected
			{
				selectionChanged: onSelectionChanged,
				selectionAdorned: false,
				background: 'white',
				mouseEnter: (e, node) => node.background = 'aquamarine',
				mouseLeave: (e, node) => node.background = node.isSelected ? 'skyblue' : 'white'
			},
			new go.Binding('background', 'isSelected', s => s ? 'skyblue' : 'white').ofObject(),
			// whether the user can start drawing a link from or to this node depends on which group it's in
			new go.Binding('fromLinkable', 'group', k => k === 'inbound'),
			new go.Binding('toLinkable', 'group', k => k === 'outbound'),
			$('TreeExpanderButton', // support expanding/collapsing subtrees
				{
					width: 14, height: 14,
					'ButtonIcon.stroke': 'white',
					'ButtonIcon.strokeWidth': 2,
					'ButtonBorder.fill': 'goldenrod',
					'ButtonBorder.stroke': null,
					'ButtonBorder.figure': 'Rectangle',
					'_buttonFillOver': 'darkgoldenrod',
					'_buttonStrokeOver': null,
					'_buttonFillPressed': null
				}
			),
			$(go.Panel, 'Horizontal',
				{ position: new go.Point(16, 0) },
				// optional icon for each tree node
				//$(go.Picture,
				//	{
				//		width: 14, height: 14,
				//		margin: new go.Margin(0, 4, 0, 0),
				//		imageStretch: go.GraphObject.Uniform,
				//		source: 'images/defaultIcon.png'
				//	},
				//new go.Binding('source', 'src')),
				//Column Type Icons
				$(go.Picture, { source: '/app-assets/images/mapping/string.png', width: 20, height: 20 }, new go.Binding('source', 'type', v => '/app-assets/images/mapping/' + v + '.png')),
				//Column name
				$(go.TextBlock, new go.Binding('text', 'text')),
				//Column type
				$(go.TextBlock, new go.Binding('text', 'type', v => ' (' + v + ')')),
			) // end Horizontal Panel
		); // end Node

	// These are the links connecting tree nodes within each group.

	// Godmark : some Layout Configure
	myDiagram.linkTemplate = $(go.Link); // without lines

	myDiagram.linkTemplate = // with lines
		$(go.Link,
			{
				selectable: false,
				routing: go.Link.Orthogonal,
				fromEndSegmentLength: 4,
				toEndSegmentLength: 4,
				fromSpot: new go.Spot(0.001, 1, 7, 0),
				toSpot: go.Spot.Left
			},
			$(go.Shape,
				{ stroke: 'lightgray' })
		);

	// These are the blue links connecting a tree node on the left side with one on the right side.
	myDiagram.linkTemplateMap.add('Mapping',
		$(MappingLink,
			{ isTreeLink: false, isLayoutPositioned: false, layerName: 'Foreground' },
			{ fromSpot: go.Spot.Right, toSpot: go.Spot.Left },
			{ relinkableFrom: true, relinkableTo: true },
			$(go.Shape, { stroke: 'blue', strokeWidth: 2 })
		));

	myDiagram.groupTemplate =
		$(go.Group, 'Auto',
			{ deletable: false, layout: makeGroupLayout() },
			new go.Binding('position', 'xy', go.Point.parse).makeTwoWay(go.Point.stringify),
			new go.Binding('layout', 'width', makeGroupLayout),
			$(go.Shape, { fill: 'white', stroke: 'lightgray' }),
			$(go.Panel, 'Vertical',
				{ defaultAlignment: go.Spot.Left },
				$(go.TextBlock,
					{ font: 'bold 14pt sans-serif', margin: new go.Margin(5, 5, 0, 5) },
					new go.Binding('text')),
				$(go.Placeholder, { padding: 5 })
			)
		);

	function makeGroupLayout() {
		return $(go.TreeLayout, // taken from samples/treeView.html
			{
				alignment: go.TreeLayout.AlignmentStart,
				angle: 0,
				compaction: go.TreeLayout.CompactionNone,
				layerSpacing: 16,
				layerSpacingParentOverlap: 1,
				nodeIndentPastParent: 1.0,
				nodeSpacing: 0,
				setsPortSpot: false,
				setsChildPortSpot: false,
				// after the tree layout, change the width of each node so that all
				// of the nodes have widths such that the collection has a given width
				commitNodes: function () { // overriding TreeLayout.commitNodes
					go.TreeLayout.prototype.commitNodes.call(this);
					if (ROUTINGSTYLE === 'ToGroup') {
						updateNodeWidths(this.group, this.group.data.width || 100);
					}
				}
			});
	}
}

// Godmark : makeTree is no use now, is copy from GOJS example
// help create a random tree structure
function makeTree(level, count, max, nodeDataArray, linkDataArray, parentdata, groupkey, rootkey) {
	const numchildren = Math.floor(Math.random() * 10);
	for (let i = 0; i < numchildren; i++) {
		if (count >= max) return count;
		count++;
		const childdata = { key: rootkey + count, text: rootkey + count, group: groupkey };
		nodeDataArray.push(childdata);
		linkDataArray.push({ from: parentdata.key, to: childdata.key });
		if (level > 0 && Math.random() > 0.5) {
			count = makeTree(level - 1, count, max, nodeDataArray, linkDataArray, childdata, groupkey, rootkey);
		}
	}
	return count;
}

// Godmark : some GOJS Event
window.addEventListener('DOMContentLoaded', init);

function updateNodeWidths(group, width) {
	if (isNaN(width)) {
		group.memberParts.each(n => {
			if (n instanceof go.Node) n.width = NaN; // back to natural width
		});
	} else {
		let minx = Infinity; // figure out minimum group width
		group.memberParts.each(n => {
			if (n instanceof go.Node) {
				minx = Math.min(minx, n.actualBounds.x);
			}
		});
		if (minx === Infinity) return;
		const right = minx + width;
		group.memberParts.each(n => {
			if (n instanceof go.Node) n.width = Math.max(0, right - n.actualBounds.x);
		});
	}
}

// this function is only needed when changing the value of ROUTINGSTYLE dynamically
function changeStyle() {
	// find user-chosen style name
	let stylename = 'ToGroup';
	const radio = document.getElementsByName('MyRoutingStyle');
	for (let i = 0; i < radio.length; i++) {
		if (radio[i].checked) {
			stylename = radio[i].value; break;
		}
	}
	if (stylename !== ROUTINGSTYLE) {
		myDiagram.commit(diag => {
			ROUTINGSTYLE = stylename;
			diag.findTopLevelGroups().each(g => updateNodeWidths(g, NaN));
			diag.layoutDiagram(true); // force layouts to happen again
			diag.links.each(l => l.invalidateRoute());
		});
	}
}

// Global variables to save previous inbound & outbound GOJS nodeDataArray & linkDataArray
let inbound_nodes = [];
let inbound_linkdata = [];
let outbound_nodes = [];
let outbound_linkdata = [];
// the Count for LoopSchemaArray use
let SchemaCount = 0;

function LoopSchemaArray(schemaArray, group, nodes, keys, linkdata) {
	//Get the Current Node , if can not find the key from keys(array) , will use SchemaCount-1
	const ParentNode = (typeof (keys[SchemaCount - 1]) == 'undefined' ? SchemaCount - 1 : keys[SchemaCount - 1]);
	// Array
	if (Array.isArray(schemaArray)) {
		for (let key in schemaArray) {
			if (key >= 0 && !Array.isArray(schemaArray[key]) && typeof (schemaArray[key]) != 'object') {
			} else {
				for (let column in schemaArray[key]) {
					const isArray = Array.isArray(schemaArray[key][column]);
					// const columnType = (isArray ? 'array' : typeof(schemaArray[key][column]));
					const columnType = (isArray ? 'array' : (typeof (schemaArray[key][column]) == 'object') ? 'object' : schemaArray[key][column]);
					const columnKey = (typeof (keys[SchemaCount]) == 'undefined' ? SchemaCount : keys[SchemaCount]);
					const nodeData = { key: columnKey, text: column, type: columnType, group: group };

					nodes.push(nodeData);

					linkdata.push({ from: ParentNode, to: (typeof (keys[SchemaCount]) == 'undefined' ? SchemaCount : keys[SchemaCount]) });
					SchemaCount++;

					if (columnType == 'array' || columnType == 'object') LoopSchemaArray(schemaArray[key][column], group, nodes, keys, linkdata);
				}
			}
		}
	}
	// Object
	else {
		for (let column in schemaArray) {
			const isArray = Array.isArray(schemaArray[column]);
			// const columnType = (isArray ? 'array' : typeof(schemaArray[column]));
			const columnType = (isArray ? 'array' : (typeof (schemaArray[column]) == 'object') ? 'object' : schemaArray[column]);
			const columnKey = (typeof (keys[SchemaCount]) == 'undefined' ? SchemaCount : keys[SchemaCount]);
			const nodeData = { key: columnKey, text: column, type: columnType, group: group };

			nodes.push(nodeData);

			linkdata.push({ from: ParentNode, to: columnKey });
			SchemaCount++;

			if (columnType == 'array' || columnType == 'object') LoopSchemaArray(schemaArray[column], group, nodes, keys, linkdata);
		}
	}
}

// Convert GOJSD to 2 variables (nodes,linkdata) let it can apply to nodeDataArray & linkDataArray
function GOJSD_Convertor(schemaText, group = 'inbound') {
	//convert API String to Json 
	const schemaData = JSON.parse(schemaText);

	let linkdata = [];
	let nodes = [];

	// keys is save the sequence of @In{} or @Out{}
	let keys = [];
	for (let keycount in schemaData['keys']) {
		keys.push(schemaData['keys'][keycount].key);
	}
	//console.log(keys);

	// Loop the "schema" from API Result
	for (let column in schemaData['schema']) {
		const isArray = Array.isArray(schemaData['schema'][column]);
		// const columnType = (isArray ? 'array' : typeof(schemaData['schema'][column]));
		const columnType = (isArray ? 'array' : (typeof (schemaData['schema'][column]) == 'object') ? 'object' : schemaData['schema'][column]);

		// node Data will be key , text, type, group 4 object
		// keys[SchemaCount] to get the @In{} or @Out{} unique name
		const nodeData = { key: keys[SchemaCount], text: column, type: columnType, group: group };

		//push the node Data into nodes
		nodes.push(nodeData);

		//SchemaCount++ to next keys
		SchemaCount++;

		// if column is array or object then loop the sub level by LoopSchemaArray
		if (columnType == 'array' || columnType == 'object') LoopSchemaArray(schemaData['schema'][column], group, nodes, keys, linkdata);
	}

	// return nodes and linkdata
	const nodes_and_linkdata = { nodes: nodes, linkdata: linkdata };

	return nodes_and_linkdata;
}

let previousLinkDataArray = [];
let previousNodeDataArray = [];

function bothSchemasExist() {
    return inbound_nodes.length > 0 && outbound_nodes.length > 0;
}

function findMatchingNode(oldNode, newNodes) {

	return newNodes.find(node => node.key === oldNode.key);
}

// Function to restore previous mappings
function restorePreviousMappings(newNodeDataArray, previousLinks) {
    const restoredLinks = [];
    
    previousLinks.forEach(link => {
        if (link.category !== 'Mapping') return;
        
        // Find the old inbound and outbound nodes
        const oldFromNode = previousNodeDataArray.find(n => n.key === link.from);
        const oldToNode = previousNodeDataArray.find(n => n.key === link.to);
        
        if (!oldFromNode || !oldToNode) return;
        
        // Find matching nodes in new schema
        const newFromNode = findMatchingNode(oldFromNode, newNodeDataArray.filter(n => n.group === 'inbound'));
        const newToNode = findMatchingNode(oldToNode, newNodeDataArray.filter(n => n.group === 'outbound'));
        
        // If both nodes exist in new schema, restore the link
        if (newFromNode && newToNode) {
            restoredLinks.push({
                category: 'Mapping',
                from: newFromNode.key,
                to: newToNode.key
            });
        }
    });
    
    return restoredLinks;
}

// Function to show confirmation dialog
function showMappingRestoreDialog() {
    return new Promise((resolve) => {
        Swal.fire({
            title: 'Are you want to use previous linkage mapping?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-secondary ml-1'
            },
            buttonsStyling: false
        }).then((result) => {
            resolve(result.isConfirmed);
        });
    });
}

$('body').on('click', '#inboundDataBind', async function () {
    const jsonData = $('#inboundFormatData').val();
    const inboundFormat = $('#select-inbound-format').val();
    const isJson = IsJsonString(jsonData);

    let url = '/mapping/convert/injson2GOJSD';
    let dataObj = JSON.stringify(JSON.parse(jsonData));
    let contentType = 'application/json';

    if (inboundFormat == 'json' && !isJson) {
        Swal.fire({
            title: 'Error!',
            text: 'Please fill in a correct inbound format JSON',
            icon: 'error',
            customClass: {
                confirmButton: 'btn btn-primary'
            },
            buttonsStyling: false,
            timer: 1200
        });
        return false;
    }

    if (inboundFormat == 'xml' && isJson) {
        Swal.fire({
            title: 'Error!',
            text: 'Please fill in a correct inbound format XML',
            icon: 'error',
            customClass: {
                confirmButton: 'btn btn-primary'
            },
            buttonsStyling: false,
            timer: 1200
        });
        return false;
    }

    if (!isJson && inboundFormat == 'xml') {
        url = '/mapping/convert/inxml2GOJSD';
        dataObj = jsonData;
        contentType = 'application/xml';
    }

    // Save current state before upload
    if (myDiagram && myDiagram.model) {
        previousLinkDataArray = JSON.parse(JSON.stringify(linkDataArray));
        previousNodeDataArray = JSON.parse(JSON.stringify(nodeDataArray));
    }

    $.ajax({
        url: url,
        method: 'POST',
        dataType: 'json',
        contentType: contentType,
        data: dataObj,
        header: {
            'content-type': contentType
        },
        success: async function (response) {
            console.log(response);
            const newInboundJson = response;

            SchemaCount = 0;
            const inboundGroup = [{ isGroup: true, key: 'inbound', text: 'Inbound Schema', xy: '0 0', width: 300 }];
            const outboundGroup = [{ isGroup: true, key: 'outbound', text: 'Outbound Schema', xy: '500 0', width: 300 }];

            const nodes_and_linkdata = GOJSD_Convertor(JSON.stringify(newInboundJson), 'inbound');

            inbound_nodes = nodes_and_linkdata.nodes;
            inbound_linkdata = nodes_and_linkdata.linkdata;

            // Prepare new node data
            const nodesResult = [...inboundGroup, ...outboundGroup, ...inbound_nodes, ...outbound_nodes];
            let linkdataResult = [...inbound_linkdata, ...outbound_linkdata];

            // Check if we should restore previous mappings
            let shouldRestore = false;
            if (bothSchemasExist() && previousLinkDataArray.length > 0) {
                const hasMappingLinks = previousLinkDataArray.some(link => link.category === 'Mapping');
                if (hasMappingLinks) {
                    shouldRestore = await showMappingRestoreDialog();
                }
            }

            // Restore mappings if user confirmed
            if (shouldRestore) {
                const restoredMappings = restorePreviousMappings(nodesResult, previousLinkDataArray);
                
                // Merge: keep tree links + restored mapping links
                const treeLinks = [...inbound_linkdata, ...outbound_linkdata];
                linkdataResult = [...treeLinks, ...restoredMappings];
                
                if (restoredMappings.length > 0) {
                    Swal.fire({
                        title: 'Success!',
                        text: `Restored ${restoredMappings.length} mapping link(s)`,
                        icon: 'success',
                        customClass: {
                            confirmButton: 'btn btn-primary'
                        },
                        buttonsStyling: false,
                        timer: 1500
                    });
                } else {
                    Swal.fire({
                        title: 'Info',
                        text: 'No matching mappings found to restore',
                        icon: 'info',
                        customClass: {
                            confirmButton: 'btn btn-primary'
                        },
                        buttonsStyling: false,
                        timer: 1500
                    });
                }
            }

            console.log('Nodes:', nodesResult);
            console.log('Links:', linkdataResult);

            // Update global variables
            nodeDataArray = nodesResult;
            linkDataArray = linkdataResult;

            // Reinitialize GOJS UI
            myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
        },
        error: function (jqXHR, exception) {
            console.log('Server error!', jqXHR, exception);
            Swal.fire({
                title: 'Error!',
                text: 'Failed to process inbound data',
                icon: 'error',
                customClass: {
                    confirmButton: 'btn btn-primary'
                },
                buttonsStyling: false
            });
        }
    });
});

// Enhanced Outbound Upload Button Function
$('body').on('click', '#outboundDataBind', async function () {
    const jsonData = $('#outboundFormatData').val();
    const outboundFormat = $('#select-outbound-format').val();
    const isJson = IsJsonString(jsonData);

    let url = '/mapping/convert/outjson2GOJSD';
    let dataObj = JSON.stringify(JSON.parse(jsonData));
    let contentType = 'application/json';

    if (outboundFormat == 'json' && !isJson) {
        Swal.fire({
            title: 'Error!',
            text: 'Please fill in a correct outbound format JSON',
            icon: 'error',
            customClass: {
                confirmButton: 'btn btn-primary'
            },
            buttonsStyling: false,
            timer: 1200
        });
        return false;
    }

    if (outboundFormat == 'xml' && isJson) {
        Swal.fire({
            title: 'Error!',
            text: 'Please fill in a correct outbound format XML',
            icon: 'error',
            customClass: {
                confirmButton: 'btn btn-primary'
            },
            buttonsStyling: false,
            timer: 1200
        });
        return false;
    }

    if (!isJson && outboundFormat == 'xml') {
        url = '/mapping/convert/outxml2GOJSD';
        dataObj = jsonData;
        contentType = 'application/xml';
    }

    // Save current state before upload
    if (myDiagram && myDiagram.model) {
        previousLinkDataArray = JSON.parse(JSON.stringify(linkDataArray));
        previousNodeDataArray = JSON.parse(JSON.stringify(nodeDataArray));
    }

    $.ajax({
        url: url,
        method: 'POST',
        dataType: 'JSON',
        contentType: contentType,
        data: dataObj,
        header: {
            'content-type': contentType
        },
        success: async function (response) {
            console.log(response);
            const newOutboundJson = response;

            SchemaCount = 0;
            const inboundGroup = [{ isGroup: true, key: 'inbound', text: 'Inbound Schema', xy: '0 0', width: 300 }];
            const outboundGroup = [{ isGroup: true, key: 'outbound', text: 'Outbound Schema', xy: '500 0', width: 300 }];

            const nodes_and_linkdata = GOJSD_Convertor(JSON.stringify(newOutboundJson), 'outbound');

            outbound_nodes = nodes_and_linkdata.nodes;
            outbound_linkdata = nodes_and_linkdata.linkdata;

            // Prepare new node data
            const nodesResult = [...inboundGroup, ...outboundGroup, ...inbound_nodes, ...outbound_nodes];
            let linkdataResult = [...inbound_linkdata, ...outbound_linkdata];

            // Check if we should restore previous mappings
            let shouldRestore = false;
            if (bothSchemasExist() && previousLinkDataArray.length > 0) {
                const hasMappingLinks = previousLinkDataArray.some(link => link.category === 'Mapping');
                if (hasMappingLinks) {
                    shouldRestore = await showMappingRestoreDialog();
                }
            }

            // Restore mappings if user confirmed
            if (shouldRestore) {
                const restoredMappings = restorePreviousMappings(nodesResult, previousLinkDataArray);
                
                // Merge: keep tree links + restored mapping links
                const treeLinks = [...inbound_linkdata, ...outbound_linkdata];
                linkdataResult = [...treeLinks, ...restoredMappings];
                
                if (restoredMappings.length > 0) {
                    Swal.fire({
                        title: 'Success!',
                        text: `Restored ${restoredMappings.length} mapping link(s)`,
                        icon: 'success',
                        customClass: {
                            confirmButton: 'btn btn-primary'
                        },
                        buttonsStyling: false,
                        timer: 1500
                    });
                } else {
                    Swal.fire({
                        title: 'Info',
                        text: 'No matching mappings found to restore',
                        icon: 'info',
                        customClass: {
                            confirmButton: 'btn btn-primary'
                        },
                        buttonsStyling: false,
                        timer: 1500
                    });
                }
            }

            console.log('Nodes:', nodesResult);
            console.log('Links:', linkdataResult);

            // Update global variables
            nodeDataArray = nodesResult;
            linkDataArray = linkdataResult;

            // Reinitialize GOJS UI
            myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
        },
        error: function (jqXHR, exception) {
            console.log('Server error!', jqXHR, exception);
            Swal.fire({
                title: 'Error!',
                text: 'Failed to process outbound data',
                icon: 'error',
                customClass: {
                    confirmButton: 'btn btn-primary'
                },
                buttonsStyling: false
            });
        }
    });
});

// Godmark : Download the inbound json format
function saveBGRSJSON() {
	let data = InboundJson;
	const filename = uuid() + gettime() + '.json';
	if (typeof data === 'object') {
		data = JSON.stringify(data, undefined, 4)
	}
	const blob = new Blob([data], { type: 'text/json' });
	let e = document.createEvent('MouseEvents');
	let a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blob);
	a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
	e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	a.dispatchEvent(e);
}

// Godmark : Download the inbound json format
function saveiRMSJSON() {
	let data = OutboundJson;
	const filename = uuid() + gettime() + '.json';;
	if (typeof data === 'object') {
		data = JSON.stringify(data, undefined, 4)
	}
	const blob = new Blob([data], { type: 'text/json' });
	let e = document.createEvent('MouseEvents');
	let a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blob);
	a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
	e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	a.dispatchEvent(e);
}

function uuid() {
	let s = [];
	const hexDigits = '0123456789abcdef';
	for (let i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = '4'; // bits 12-15 of the time_hi_and_version field to 0010
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
	s[8] = s[13] = s[18] = s[23] = '-';

	const uuid = s.join('');
	return uuid;
}

function gettime() {
	const today = new Date();
	const y = today.getFullYear();
	const m = today.getMonth();
	const d = today.getDate();
	const h = today.getHours();
	const i = today.getMinutes();
	const s = today.getSeconds(); // 在小于10的数字钱前加一个‘0’
	m = m + 1;
	d = checkTime(d);
	m = checkTime(m);
	i = checkTime(i);
	s = checkTime(s);
	$('#time').html(y + '年' + m + '月' + d + '日' + ' ' + h + ':' + i + ':' + s);
	return (y + '-' + m + '-' + d + '-' + ' ' + h + ':' + i + ':' + s);
}

function checkTime(i) {
	if (i < 10) {
		i = '0' + i;
	}
	return i;
}

function IsJsonString(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}
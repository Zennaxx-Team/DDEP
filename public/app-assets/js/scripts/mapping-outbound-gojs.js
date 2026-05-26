var itemPropertiesOutbound = [],
	currentItemPropertyOutbound = {},
	currentItemPropertyOutboundEnable = 0;
var propsOutboundValidationRowCounter = 1;
var propsOutboundFormatRowCounter = 1;

function mappingoutboundformuladatafunc(itemKey, itemName, linkedItems) {
	if (currentItemPropertyOutboundEnable == 1) {
		var itemProperty = {},
			display = {},
			validation = {},
			format = {},
			itemPropertyKey = '';

		itemProperty = currentItemPropertyOutbound;

		display.value = $('#mapping-outbound-formula-props #props-outbound-display-value').val();
		display.defaultValue = $('#mapping-outbound-formula-props #props-outbound-display-default-value').val();
		itemProperty["display"] = display;

		validation.isRequired = $("#mapping-outbound-formula-props #props-outbound-validation-is-required option:selected").val();
		validation.valueMustbe = $("#mapping-outbound-formula-props #props-outbound-validation-value-must-be option:selected").val();
		var validationAdditonalRules = [];
		$("#prop-outbound-validation-additional-rules-table").find('tbody tr').each(function (i) {
			var validationAdditonalRule = {};
			var $fieldset = $(this);
			validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
			validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
			validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
			validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
			validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
			validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
			validationAdditonalRules.push(validationAdditonalRule);
		});
		validation.additonal_rules = validationAdditonalRules;
		itemProperty["validation"] = validation;

		format.trim = $("#mapping-outbound-formula-props #props-outbound-format-is-trim option:selected").val();
		format.enableRounding = $("#mapping-outbound-formula-props #props-outbound-format-enable-rounding option:selected").val();
		format.enabeDecimal = $("#mapping-outbound-formula-props #props-outbound-format-enable-decimal option:selected").val();
		format.decimal = $('#mapping-outbound-formula-props #props-outbound-format-decimal').val();
		var formatAdditonalRules = [];
		$("#prop-outbound-format-additional-rules-table").find('tbody tr').each(function (i) {
			var formatAdditonalRule = {};
			var $fieldset = $(this);
			formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

			if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
				formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
			} else {
				formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
			}

			if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
				formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
			} else {
				formatAdditonalRule.formulatonew = '';
			}

			formatAdditonalRules.push(formatAdditonalRule);
		});
		format.additonal_rules = formatAdditonalRules;
		itemProperty["format"] = format;

		itemPropertyKey = itemProperty.general.itemKey;

		if (itemPropertiesOutbound.length > 0) {
			for (var i = 0; i < itemPropertiesOutbound.length; i++) {
				if (itemPropertiesOutbound[i].general.itemKey == itemPropertyKey) {
					itemPropertiesOutbound[i] = itemProperty;
					itemPropertyKey = '';
				}
			}
		}

		if (itemPropertyKey != "") {
			itemPropertiesOutbound.push(itemProperty);
		}
	}

	var general = {};
	general.itemName = itemName;
	general.itemKey = itemKey;

	currentItemPropertyOutbound = {};
	currentItemPropertyOutbound["general"] = general;
	currentItemPropertyOutbound["linkedItems"] = linkedItems;

	var linkedItemsRows = '';
	for (var i = 0; i < linkedItems.length; i++) {
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

	var displayValue = '=' + currentItemPropertyOutbound.general.itemKey,
		displaydefaultValue = '',
		validationIsRequired = 'FALSE', 
		validationValueMustbe = '', 
		formatTrim = 'FALSE', 
		formatEnableRounding = 'FALSE', 
		formatEnabeDecimal = 'FALSE', 
		formatDecimal = 2,
		propValidationAdditionalRulesTr = '',
		propFormatAdditionalRulesTr = '';

	if (itemPropertiesOutbound.length > 0) {
		for (var i = 0; i < itemPropertiesOutbound.length; i++) {
			if (itemPropertiesOutbound[i].general.itemKey == itemKey) {
				var itemFormatAdditionalRules = itemPropertiesOutbound[i].format.additonal_rules;

				displayValue = itemPropertiesOutbound[i].display.value;
				displaydefaultValue = itemPropertiesOutbound[i].display.defaultValue;
				validationIsRequired = itemPropertiesOutbound[i].validation.isRequired;
				validationValueMustbe = itemPropertiesOutbound[i].validation.valueMustbe;

				if (itemPropertiesOutbound[i].validation.additonal_rules != undefined) {
					var propValidationAdditonalRules = itemPropertiesOutbound[i].validation.additonal_rules;
					for (var j = 0; j < propValidationAdditonalRules.length; j++) {
						propValidationAdditionalRulesTr += '<tr><td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND"';

						if (propValidationAdditonalRules[j].logical == 'AND') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>AND</option><option value="OR"';
						if (propValidationAdditonalRules[j].logical == 'OR') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>OR</option>';
						propValidationAdditionalRulesTr += '</select></td><td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundoriginal_' + j + '" value="' + propValidationAdditonalRules[j].original + '"/></td><td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="=="';

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

						propValidationAdditionalRulesTr += '>Contains</option></select></td><td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundcolumn_' + j + '" value="' + propValidationAdditonalRules[j].column + '"/></td><td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][then]"><option value="STOP"';

						if (propValidationAdditonalRules[j].then == 'STOP') {
							propValidationAdditionalRulesTr += ' selected';
						}

						propValidationAdditionalRulesTr += '>STOP</option>';
						propValidationAdditionalRulesTr += '</select></td><td class="col-sm-2"><input type="text" name="propsvalidations[][formula]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundformula_' + j + '" value="' + propValidationAdditonalRules[j].formula + '"/></td><td class="col-sm-2"><a href="javascript:void(0);" type="button" class="prop-validation-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td></tr>';
					}

					propsOutboundValidationRowCounter = propValidationAdditonalRules.length;
				}

				formatTrim = itemPropertiesOutbound[i].format.trim;
				formatEnableRounding = itemPropertiesOutbound[i].format.enableRounding;
				formatEnabeDecimal = itemPropertiesOutbound[i].format.enabeDecimal;
				formatDecimal = itemPropertiesOutbound[i].format.decimal;

				if (itemFormatAdditionalRules != undefined) {
					var propFormatAdditonalRules = itemFormatAdditionalRules;
					for (var l = 0; l < propFormatAdditonalRules.length; l++) {
						propFormatAdditionalRulesTr += '<tr id="prop-outbound-format-additional-rules-table-row-' + l + '">';
						propFormatAdditionalRulesTr += '<td class="col-sm-1 format-rules-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';

						propFormatAdditionalRulesTr += '<td class="col-sm-3"><select class="select-dropdown form-control form-control-lg format-additional-rules-name" name="formatrules[][name]" id="format-outbound-additional-rules-name-' + l + '"><option value="REPLACE"';

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
						propFormatAdditionalRulesTr += "<input type='text' name='formatrules[][formulato]' class='form-control border-0 autocompleteformulaoutbound' id='format-outbound-additional-rules-formulato-" + l + "' value='" + propFormatAdditonalRules[l].formulato + "' ";

						if (propFormatAdditonalRules[l].name == 'TRIM' || propFormatAdditonalRules[l].name == 'LEFT TRIM' || propFormatAdditonalRules[l].name == 'RIGHT TRIM') {
							propFormatAdditionalRulesTr += 'style="display: none;"';
						} else {}

						propFormatAdditionalRulesTr += '/>';
						propFormatAdditionalRulesTr += '<select class="select-dropdown form-control form-control-lg" name="formatrules[][formulatodropdown]" id="format-outbound-additional-rules-formulatodropdown-' + l + '" ';

						if (propFormatAdditonalRules[l].name == 'TRIM' || propFormatAdditonalRules[l].name == 'LEFT TRIM' || propFormatAdditonalRules[l].name == 'RIGHT TRIM') {} else {
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

						if (propFormatAdditonalRules[l].name == 'REPLACE' || propFormatAdditonalRules[l].name == 'SUBSTRING') {
							propFormatAdditionalRulesTr += "<input type='text' name='formatrules[][formulatonew]' class='form-control border-0' id='format-outbound-additional-rules-formulatonew-" + l + "' value='" + propFormatAdditonalRules[l].formulatonew + "'/>";
						}

						propFormatAdditionalRulesTr += '</td>';
						propFormatAdditionalRulesTr += '<td class="col-sm-1"><a href="javascript:void(0);" type="button" class="prop-format-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
						propFormatAdditionalRulesTr += '</tr>';
					}

					propsOutboundFormatRowCounter = propFormatAdditonalRules.length;
				}
			}
		}
	}

	$('#mapping-outbound-formula-props #props-outbound-general-item').html(itemName);
	$('#mapping-outbound-formula-props .table-section-linked-items-rows').remove();
	$('#mapping-outbound-formula-props #table-outbound-section-linked-items-row').after(linkedItemsRows);
	$('#mapping-outbound-formula-props #props-outbound-display-value').val(displayValue);
	$('#mapping-outbound-formula-props #props-outbound-display-default-value').val(displaydefaultValue);

	$('#mapping-outbound-formula-props #props-outbound-validation-is-required > option[value="' + validationIsRequired + '"]').attr('selected', 'selected').prop('selected', true);

	$('#mapping-outbound-formula-props #props-outbound-validation-value-must-be > option[value="' + validationValueMustbe + '"]').attr('selected', true).prop('selected', true);

	$("table.prop-outbound-validation-additional-rules-table tbody").html(propValidationAdditionalRulesTr);
	if (propValidationAdditionalRulesTr == '') {
		$('#prop-outbound-validation-additional-rules-btn-add-row').trigger('click');
	}

	$('#mapping-outbound-formula-props #props-outbound-format-is-trim > option[value="' + formatTrim + '"]').attr('selected', 'selected').prop('selected', true);

	$('#mapping-outbound-formula-props #props-outbound-format-enable-rounding > option[value="' + formatEnableRounding + '"]').attr('selected', 'selected').prop('selected', true);

	$('#mapping-outbound-formula-props #props-outbound-format-enable-decimal > option[value="' + formatEnabeDecimal + '"]').attr('selected', 'selected').prop('selected', true);

	$('#mapping-outbound-formula-props #props-outbound-format-decimal').val(formatDecimal);

	$("table.prop-outbound-format-additional-rules-table tbody").html(propFormatAdditionalRulesTr);
	if (propFormatAdditionalRulesTr == '') {
		$('#prop-outbound-format-additional-rules-btn-add-row').trigger('click');
	}

	currentItemPropertyOutboundEnable = 1;
}

// Godmark : this is GOJS default sample code
// Use a TreeNodeOutbound so that when a node is not visible because a parent is collapsed,
// connected links seem to be connected with the lowest visible parent node.
// This also forces other links connecting with nodes in the group to be rerouted,
// because collapsing/expanding nodes will cause many nodes to move and to appear or disappear.
class TreeNodeOutbound extends go.Node {
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
		var n = this;
		while (n !== null && !n.isVisible()) {
			n = n.findTreeParentNode();
		}
		return n;
	}
}
// end TreeNodeOutbound

// Godmark : this is GOJS to control the layout type , you can review the example in https://gojs.net/latest/samples/treeMapper.html , there have ToGroup , Normal , ToNode 3 options there
// Control how Mapping links are routed:
// - "Normal": normal routing with fixed fromEndSegmentLength & toEndSegmentLength
// - "ToGroup": so that the link routes stop at the edge of the group,
//		rather than going all the way to the connected nodes
// - "ToNode": so that they go all the way to the connected nodes
//		but only bend at the edge of the group
var ROUTINGSTYLEOUTBOUND = "ToGroup";

// Godmark : MappingLinkOutbound Class
// If you want the regular routing where the Link.[from/to]EndSegmentLength controls
// the length of the horizontal segment adjacent to the port, don't use this class.
// Replace MappingLinkOutbound with a go.Link in the "Mapping" link template.
class MappingLinkOutbound extends go.Link {
	getLinkPointOutbound(node, port, spot, from, ortho, othernode, otherport) {
		if (ROUTINGSTYLEOUTBOUND !== "ToGroup") {
			return super.getLinkPointOutbound(node, port, spot, from, ortho, othernode, otherport);
		} else {
			var r = port.getDocumentBounds();
			var group = node.containingGroup;
			var b = (group !== null) ? group.actualBounds : node.actualBounds;
			var op = othernode.getDocumentPoint(go.Spot.Center);
			var x = (op.x > r.centerX) ? b.right : b.left;
			return new go.Point(x, r.centerY);
		}
	}

	computePointsOutbound() {
		var result = super.computePointsOutbound();
		if (result && ROUTINGSTYLEOUTBOUND === "ToNode") {
			var fn = this.fromNode;
			var tn = this.toNode;
			if (fn && tn) {
				var fg = fn.containingGroup;
				var fb = fg ? fg.actualBounds : fn.actualBounds;
				var fpt = this.getPoint(0);
				var tg = tn.containingGroup;
				var tb = tg ? tg.actualBounds : tn.actualBounds;
				var tpt = this.getPoint(this.pointsCount-1);
				this.setPoint(1, new go.Point((fpt.x < tpt.x) ? fb.right : fb.left, fpt.y));
				this.setPoint(this.pointsCount-2, new go.Point((fpt.x < tpt.x) ? tb.left : tb.right, tpt.y));
			}
		}
		return result;
	}
}
// end MappingLinkOutbound

// Godmark : nodeDataArrayOutbound is data for control Left and Right Box UI Display
var nodeDataArrayOutbound = [];
// Godmark : linkDataArrayOutbound is data for control the relationship , we can make it empty as this moment
var linkDataArrayOutbound = [];

var CurrentModelOutbound = null;
function initOutbound() {
	// Since 2.2 you can also author concise templates with method chaining instead of GraphObject.make
	// For details, see https://gojs.net/latest/intro/buildingObjects.html
	const $ = go.GraphObject.make; // for conciseness in defining templates
	//Godmark : after drag & drop event make some relationship , can trigger the GOJS mapping reuslt into some textbox
	outboundmyDiagram =
	$(go.Diagram, "outboundMyDiagramDiv",
	{
		"commandHandler.copiesTree": true,
		"commandHandler.deletesTree": true,
		// newly drawn links always map a node in one tree to a node in another tree
		"linkingTool.archetypeLinkData": {category: "Mapping"},
		"linkingTool.linkValidation": checkLinkOutbound,
		"relinkingTool.linkValidation": checkLinkOutbound,
		"undoManager.isEnabled": true,
		"ModelChanged": e => {
			if (e.isTransactionFinished) { // show the model data in the page's TextArea
				document.getElementById("outboundmySavedModel").textContent = e.model.toJson();
				document.getElementById("outboundmySavedModel2").value = e.model.toJson();
				CurrentModelOutbound = e.model;
			}
		}
	});

	// Godmark : some link control
	// All links must go from a node inside the "Left Side" Group to a node inside the "Right Side" Group.
	function checkLinkOutbound(fn, fp, tn, tp, link) {
		// make sure the nodes are inside different Groups
		if (fn.containingGroup === null || fn.containingGroup.data.key !== "inbound") return false;
		if (tn.containingGroup === null || tn.containingGroup.data.key !== "outbound") return false;

		// fn = Inbound Column
		if (fn.data.type == "object") {
			// tn = Outbound Column
			if (tn.data.type == "integer" || tn.data.type == "number" || tn.data.type == "boolean") return false;
		}

		// fn = Inbound Column
		if (fn.data.type == "string") {
			// tn = Outbound Column
			if (tn.data.type == "integer" || tn.data.type == "number" || tn.data.type == "boolean") return false;
		}

		// fn = Inbound Column
		if (fn.data.type == "array") {
			// tn = Outbound Column
			if (tn.data.type == "object" || tn.data.type == "integer" || tn.data.type == "number" || tn.data.type == "boolean") return false;
		}
		//// optional limit to a single mapping link per node
		if (tn.linksConnected.any(l => l.category === "Mapping") && tn.data.type != "array") return false;
		//if (fn.linksConnected.any(l => l.category === "Mapping")) return false;
		//if (tn.linksConnected.any(l => l.category === "Mapping")) return false;
		return true;
	}

	function onSelectionChangedOutbound(node) {
		if (node.isSelected) {
			// Try to open properties here
			console.log(node.data);
			var itemKey = node.data.key;
			var itemName = node.data.text;
			var itemGroup = node.data.group;
			console.log(node.linksConnected);
			var linksConnected = node.linksConnected;
			var linkedItems = [];
			while (linksConnected.next()) {
				console.log(linksConnected.value);
				var linkedItem = {};
				if (itemGroup == 'outbound') {
					if (itemGroup != linksConnected.value.fromNode.data.group) {
						console.log(linksConnected.value.fromNode.data);
						var linkedItemKey = linksConnected.value.fromNode.data.key;
						var linkedItemText = linksConnected.value.fromNode.data.text;
						linkedItem['itemName'] = linkedItemText;
						linkedItem['itemKey'] = linkedItemKey;
					}
				} else {
					if (itemGroup != linksConnected.value.toNode.data.group) {
						console.log(linksConnected.value.toNode.data);
						var linkedItemKey = linksConnected.value.toNode.data.key;
						var linkedItemText = linksConnected.value.toNode.data.text;
						linkedItem['itemName'] = linkedItemText;
						linkedItem['itemKey'] = linkedItemKey;
					}
				}
				linkedItems.push(linkedItem);
			}
			mappingoutboundformuladatafunc(itemKey, itemName, linkedItems);
		}
	}

	// Godmark : some GOJS event setting , if you want the display name on the UI Box show "text" or another variable from nodeDataArrayOutbound , can be setup here , e.g. $(go.TextBlock, new go.Binding("text",))
	// Each node in a tree is defined using the default nodeTemplate.
	outboundmyDiagram.nodeTemplate =
	$(TreeNodeOutbound,
		{movable: false, copyable: false, deletable: false}, // user cannot move an individual node
		// no Adornment: instead change panel background color by binding to Node.isSelected
		{
			selectionChanged: onSelectionChangedOutbound,
			selectionAdorned: false,
			background: "white",
			mouseEnter: (e, node) => node.background = "aquamarine",
			mouseLeave: (e, node) => node.background = node.isSelected ? "skyblue" : "white"
		},
		new go.Binding("background", "isSelected", s => s ? "skyblue" : "white").ofObject(),
		// whether the user can start drawing a link from or to this node depends on which group it's in
		new go.Binding("fromLinkable", "group", k => k === "inbound"),
		new go.Binding("toLinkable", "group", k => k === "outbound"),
		$("TreeExpanderButton", // support expanding/collapsing subtrees
			{
				width: 14, height: 14,
				"ButtonIcon.stroke": "white",
				"ButtonIcon.strokeWidth": 2,
				"ButtonBorder.fill": "goldenrod",
				"ButtonBorder.stroke": null,
				"ButtonBorder.figure": "Rectangle",
				"_buttonFillOver": "darkgoldenrod",
				"_buttonStrokeOver": null,
				"_buttonFillPressed": null
			}
		),
		$(go.Panel, "Horizontal",
			{position: new go.Point(16, 0)},
			// optional icon for each tree node
			//$(go.Picture,
			//	{
			//		width: 14, height: 14,
			//		margin: new go.Margin(0, 4, 0, 0),
			//		imageStretch: go.GraphObject.Uniform,
			//		source: "images/defaultIcon.png"
			//	},
			//new go.Binding("source", "src")),
			//Column Type Icons
			$(go.Picture, {source: "string.png", width: 20, height: 20}, new go.Binding("source", "type", v => "/app-assets/images/mapping/" + v + ".png")),
			//Column name
			$(go.TextBlock,new go.Binding("text", "text")),
			//Column type
			$(go.TextBlock, new go.Binding("text", "type", v => " (" + v + ")" )),
		) // end Horizontal Panel
	); // end Node

	// These are the links connecting tree nodes within each group.

	// Godmark : some Layout Configure
	outboundmyDiagram.linkTemplate = $(go.Link); // without lines

	outboundmyDiagram.linkTemplate = // with lines
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
		{stroke: "lightgray"})
	);

	// These are the blue links connecting a tree node on the left side with one on the right side.
	outboundmyDiagram.linkTemplateMap.add("Mapping",
	$(MappingLinkOutbound,
		{isTreeLink: false, isLayoutPositioned: false, layerName: "Foreground"},
		{fromSpot: go.Spot.Right, toSpot: go.Spot.Left},
		{relinkableFrom: true, relinkableTo: true},
		$(go.Shape, {stroke: "blue", strokeWidth: 2})
	));

	outboundmyDiagram.groupTemplate =
	$(go.Group, "Auto",
		{deletable: false, layout: makeGroupLayoutOutbound()},
		new go.Binding("position", "xy", go.Point.parse).makeTwoWay(go.Point.stringify),
		new go.Binding("layout", "width", makeGroupLayoutOutbound),
		$(go.Shape, {fill: "white", stroke: "lightgray"}),
		$(go.Panel, "Vertical",
			{defaultAlignment: go.Spot.Left},
			$(go.TextBlock,
				{font: "bold 14pt sans-serif", margin: new go.Margin(5, 5, 0, 5)},
			new go.Binding("text")),
			$(go.Placeholder, {padding: 5})
		)
	);

	function makeGroupLayoutOutbound() {
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
			commitNodes: function() { // overriding TreeLayout.commitNodes
				go.TreeLayout.prototype.commitNodes.call(this);
				if (ROUTINGSTYLEOUTBOUND === "ToGroup") {
					updateNodeWidthsOutbound(this.group, this.group.data.width || 100);
				}
			}
		});
	}
}

// Godmark : makeTreeOutbound is no use now, is copy from GOJS example
// help create a random tree structure
function makeTreeOutbound(level, count, max, nodeDataArrayOutbound, linkDataArrayOutbound, parentdata, groupkey, rootkey) {
	var numchildren = Math.floor(Math.random() * 10);
	for (var i = 0; i < numchildren; i++) {
		if (count >= max) return count;
		count++;
		var childdata = {key: rootkey + count, text: rootkey + count, group: groupkey};
		nodeDataArrayOutbound.push(childdata);
		linkDataArrayOutbound.push({from: parentdata.key, to: childdata.key});
		if (level > 0 && Math.random() > 0.5) {
			count = makeTreeOutbound(level - 1, count, max, nodeDataArrayOutbound, linkDataArrayOutbound, childdata, groupkey, rootkey);
		}
	}
	return count;
}

// Godmark : some GOJS Event
window.addEventListener('DOMContentLoaded', initOutbound);

function updateNodeWidthsOutbound(group, width) {
	if (isNaN(width)) {
		group.memberParts.each(n => {
			if (n instanceof go.Node) n.width = NaN; // back to natural width
		});
	} else {
		var minx = Infinity; // figure out minimum group width
		group.memberParts.each(n => {
			if (n instanceof go.Node) {
				minx = Math.min(minx, n.actualBounds.x);
			}
		});
		if (minx === Infinity) return;
		var right = minx + width;
		group.memberParts.each(n => {
			if (n instanceof go.Node) n.width = Math.max(0, right - n.actualBounds.x);
		});
	}
}

// this function is only needed when changing the value of ROUTINGSTYLEOUTBOUND dynamically
function changeStyleOutbound() {
	// find user-chosen style name
	var stylename = "ToGroup";
	var radio = document.getElementsByName("MyRoutingStyleOutbound");
	for (var i = 0; i < radio.length; i++) {
		if (radio[i].checked) {
			stylename = radio[i].value; break;
		}
	}
	if (stylename !== ROUTINGSTYLEOUTBOUND) {
		outboundmyDiagram.commit(diag => {
			ROUTINGSTYLEOUTBOUND = stylename;
			diag.findTopLevelGroups().each(g => updateNodeWidthsOutbound(g, NaN));
			diag.layoutDiagram(true); // force layouts to happen again
			diag.links.each(l => l.invalidateRoute());
		});
	}
}

// Global variables to save previous inbound & outbound GOJS nodeDataArrayOutbound & linkDataArrayOutbound
var inbound_nodes_outbound = [];
var inbound_linkdata_outbound = [];
var outbound_nodes_outbound = [];
var outbound_linkdata_outbound = [];
// the Count for LoopSchemaArrayOutbound use
var SchemaCountOutbound = 0;

function LoopSchemaArrayOutbound(schemaArray, group, nodes, keys, linkdata)
{
	//Get the Current Node , if can not find the key from keys(array) , will use SchemaCountOutbound-1
	var ParentNode = (typeof(keys[SchemaCountOutbound-1]) == 'undefined' ? SchemaCountOutbound-1 : keys[SchemaCountOutbound-1]);
	// Array
	if (Array.isArray(schemaArray)) {
		for (var key in schemaArray) {
			if (key >= 0 && !Array.isArray(schemaArray[key]) && typeof(schemaArray[key]) != 'object') {
			} else {
				for (var column in schemaArray[key]) {
					var isArray = Array.isArray(schemaArray[key][column]);
					// var columnType = (isArray ? 'array' : typeof(schemaArray[key][column]));
					var columnType = (isArray ? 'array' : (typeof(schemaArray[key][column]) == 'object') ? 'object' : schemaArray[key][column]);
					var columnKey = (typeof(keys[SchemaCountOutbound]) == 'undefined' ? SchemaCountOutbound : keys[SchemaCountOutbound]);
					var nodeData = {key: columnKey, text: column, type: columnType, group: group};

					nodes.push(nodeData);

					linkdata.push({from: ParentNode, to:(typeof(keys[SchemaCountOutbound]) == 'undefined' ? SchemaCountOutbound : keys[SchemaCountOutbound])});
					SchemaCountOutbound++;

					if (columnType == 'array' || columnType == 'object') LoopSchemaArrayOutbound(schemaArray[key][column], group, nodes, keys, linkdata);
				}
			}
		}
	} 
	// Object
	else {
		for (var column in schemaArray) {
			var isArray = Array.isArray(schemaArray[column]);
			// var columnType = (isArray ? 'array' : typeof(schemaArray[column]));
			var columnType = (isArray ? 'array' : (typeof(schemaArray[column]) == 'object') ? 'object' : schemaArray[column]);
			var columnKey = (typeof(keys[SchemaCountOutbound]) == 'undefined' ? SchemaCountOutbound : keys[SchemaCountOutbound]);
			var nodeData = {key: columnKey, text: column, type: columnType, group: group};

			nodes.push(nodeData);

			linkdata.push({from:ParentNode, to:columnKey});
			SchemaCountOutbound++;

			if (columnType == 'array' || columnType == 'object') LoopSchemaArrayOutbound(schemaArray[column], group, nodes, keys, linkdata);
		}
	}
}

// Convert GOJSD to 2 variables (nodes,linkdata) let it can apply to nodeDataArrayOutbound & linkDataArrayOutbound
function GOJSD_ConvertorOutbound(schemaText, group = "inbound") {
	//convert API String to Json 
	var schemaData = JSON.parse(schemaText);

	var linkdata = [];
	var nodes = [];

	// keys is save the sequence of @In{} or @Out{}
	var keys = [];
	for (var keycount in schemaData["keys"]) {
		keys.push(schemaData["keys"][keycount].key);
	}
	//console.log(keys);

	// Loop the "schema" from API Result
	for (var column in schemaData["schema"]) {
		var isArray = Array.isArray(schemaData["schema"][column]);
		// var columnType = (isArray ? 'array' : typeof(schemaData["schema"][column]));
		var columnType = (isArray ? 'array' : (typeof(schemaData["schema"][column]) == 'object') ? 'object' : schemaData["schema"][column]);

		// node Data will be key , text, type, group 4 object
		// keys[SchemaCountOutbound] to get the @In{} or @Out{} unique name
		var nodeData = {key: keys[SchemaCountOutbound], text: column, type: columnType, group: group};

		//push the node Data into nodes
		nodes.push(nodeData);

		//SchemaCountOutbound++ to next keys
		SchemaCountOutbound++;

		// if column is array or object then loop the sub level by LoopSchemaArrayOutbound
		if (columnType == 'array' || columnType == 'object') LoopSchemaArrayOutbound(schemaData["schema"][column], group, nodes, keys, linkdata);
	}

	// return nodes and linkdata
	var nodes_and_linkdata = {nodes:nodes,linkdata:linkdata};

	return nodes_and_linkdata;
}

// Function for Inbound Upload Button
$('body').on("click", "#InboundDataBind_outbound", function() {
	var jsonData = $("#InboundFormatData_outbound").val();
	var outbound_format = $('#outbound_format').val();
	var isJson = IsJsonString(jsonData);

	if (outbound_format == 'json' && !isJson) {
		alert("Please fill in a correct outbound format JSON");
		return false;
	}

	if (outbound_format == 'xml' && isJson) {
		alert("Please fill in a correct outbound format XML");
		return false;
	}

	if (isJson && outbound_format == 'json') {
		var url = '/mapping/convert/injson2GOJSD';
		var dataObj = JSON.stringify(JSON.parse(jsonData));
		var contentType = "application/json";
	} else if (!isJson && outbound_format == 'xml') {
		var url = '/mapping/convert/inxml2GOJSD';
		var dataObj = jsonData;
		var contentType = "application/xml";
	}

	$.ajax({
		url: url,
		method: 'POST',
		dataType: 'json',
		contentType: contentType,
		data: dataObj,
		header: {
			"content-type": contentType
		},
		success: function(response) {
			console.log(response);
			var newInboundJson = response;

			SchemaCountOutbound = 0;
			// Inbound and Outbund Group in GOJS UI
			var inboundGroup = [{isGroup: true, key: "inbound", text: "Outbound Response Schema", xy: "0 0", width: 400}];
			var outboundGroup = [{isGroup: true, key: "outbound", text: "Conversion Outbound Response Schema", xy: "800 0", width: 400}];

			// When user fill in Inbound_Format Textbox (id=InboundFormat)
			// must post this Textbox value injson2GOJSD API, and then GOJSD_ConvertorOutbound(<injson2GOJSD result>, "inbound");
			var nodes_and_linkdata = GOJSD_ConvertorOutbound(JSON.stringify(newInboundJson), "inbound");

			// GOJSD_ConvertorOutbound will return the (obj).nodes & (obj).linkdata
			inbound_nodes_outbound = nodes_and_linkdata.nodes;
			inbound_linkdata_outbound = nodes_and_linkdata.linkdata;

			// 2 Variables to merge previous outbound scheme
			var nodesResult = [...inboundGroup,...outboundGroup,...inbound_nodes_outbound,...outbound_nodes_outbound];
			var linkdataResult = [...inbound_linkdata_outbound,...outbound_linkdata_outbound];

			console.log(nodesResult);
			console.log(linkdataResult);

			// apply 2 merged variables into nodeDataArrayOutbound & linkDataArrayOutbound
			nodeDataArrayOutbound = nodesResult;
			linkDataArrayOutbound = linkdataResult;

			//Init GOJS UI
			outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArrayOutbound, linkDataArrayOutbound);
		},
		error: function(jqXHR, exception) {
			console.log(response);
			console.log('server error!');
		}
	});
});

// Function for Outbound Upload Button, all comments can reference to InboundDataBind();
$('body').on("click", "#OutboundDataBind_outbound", function() {
	var jsonData = $("#OutboundFormatData_outbound").val();
	var isJson = IsJsonString(jsonData);

	if (isJson) {
		var url = '/mapping/convert/outjson2GOJSD';
		var dataObj = JSON.stringify(JSON.parse(jsonData));
		var contentType = "application/json";
	} else {
		var url = '/mapping/convert/outxml2GOJSD';
		var dataObj = jsonData;
		var contentType = "application/xml";
	}

	$.ajax({
		url: url,
		method: 'POST',
		dataType: 'JSON',
		contentType: contentType,
		data: dataObj,
		header: {
			"content-type": contentType
		},
		success: function(response) {
			console.log(response);
			var newOutboundJson = response;

			SchemaCountOutbound = 0;
			var inboundGroup = [{isGroup: true, key: "inbound", text: "Outbound Response Schema", xy: "0 0", width: 400}];
			var outboundGroup = [{isGroup: true, key: "outbound", text: "Conversion Outbound Response Schema", xy: "1000 0", width: 400}];

			var nodes_and_linkdata = GOJSD_ConvertorOutbound(JSON.stringify(newOutboundJson), "outbound");

			outbound_nodes_outbound = nodes_and_linkdata.nodes;
			outbound_linkdata_outbound = nodes_and_linkdata.linkdata;

			var nodesResult = [...inboundGroup,...outboundGroup,...inbound_nodes_outbound,...outbound_nodes_outbound];
			var linkdataResult = [...inbound_linkdata_outbound,...outbound_linkdata_outbound];

			console.log(nodesResult);
			console.log(linkdataResult);

			nodeDataArrayOutbound = nodesResult;
			linkDataArrayOutbound = linkdataResult;

			outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArrayOutbound, linkDataArrayOutbound);
		},
		error: function(jqXHR, exception) {
			console.log(response);
			console.log('server error!');
		}
	});
});

// Godmark : Download the inbound json format
function saveBGRSJSON() {
	var data = InboundJson;
	var filename = uuid() + gettime() + ".json";
	if (typeof data === 'object') {
		data = JSON.stringify(data, undefined, 4)
	}
	var blob = new Blob([data], {type: 'text/json'});
	var e = document.createEvent('MouseEvents');
	var a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blob);
	a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
	e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	a.dispatchEvent(e);
}

// Godmark : Download the inbound json format
function saveiRMSJSON() {
	var data = OutboundJson;
	var filename = uuid() + gettime() + ".json";;
	if (typeof data === 'object') {
		data = JSON.stringify(data, undefined, 4)
	}
	var blob = new Blob([data], {type: 'text/json'});
	var e = document.createEvent('MouseEvents');
	var a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blob);
	a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
	e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	a.dispatchEvent(e);
}

function uuid() {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
	s[8] = s[13] = s[18] = s[23] = "-";

	var uuid = s.join("");
	return uuid;
}

function gettime() {
	var today = new Date();
	var y = today.getFullYear();
	var m = today.getMonth();
	var d = today.getDate();
	var h = today.getHours();
	var i = today.getMinutes();
	var s = today.getSeconds(); // 在小于10的数字钱前加一个‘0’
	m = m + 1;
	d = checkTime(d);
	m = checkTime(m);
	i = checkTime(i);
	s = checkTime(s);
	$('#time').html(y + "年" + m + "月" + d + "日" + " " + h + ":" + i + ":" + s);
	return (y + "-" + m + "-" + d + "-" + " " + h + ":" + i + ":" + s);
}

function checkTime(i) {
	if (i < 10) {
		i = "0" + i;
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
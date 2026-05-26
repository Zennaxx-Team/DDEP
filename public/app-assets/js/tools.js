if ($("#frm-post-tools").length) {
	$("#frm-post-tools").validate({
		errorClass: "help-block animation-slideDown error",
		errorElement: "div",
		errorPlacement: function(error, e) {
			e.parents(".form-group").append(error);
		},
		highlight: function(e) {
			$(e).removeClass("success error").addClass("error");
			$(e).closest(".help-block").remove();
		},
		success: function(e) {
			e.removeClass("success error");
			e.closest(".help-block").remove();
		},
		Submit: function() {
		},
		rules: {
			ddepInboundAPI: {
				required: true
			},
			ddepInboundData: {
				required: true
			}
		},
		messages: {
			ddepInboundAPI: {
				required : "Please enter DDEP Inbound API",
			},
			ddepInboundData: {
				required : "Please enter DDEP Inbound Data",
			},
		},
		submitHandler: function(e) {
			$("#ddepOutboundResponseData").val("");
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			const url = $("#ddepInboundAPI").val();
			let data = $("#ddepInboundData").val();
			let contentType = "application/json";

			try {
				data = JSON.parse(JSON.stringify(data));
			} catch (error) {
				data = data;
				contentType = "application/xml";
			}

			$.ajax({
				url: url,
				method: "POST",
				contentType: contentType,
				data: data,
				beforeSend: function(xhr) {xhr.setRequestHeader('X-Test-Tool', 'true');},
				success: function(response, status, xhr) {
					const content_type = xhr.getResponseHeader("content-type") || "";

					if (response.MsgCode !== undefined && response.MsgCode === "20001") {
						if (response.Data !== undefined && response.Data[0] !== undefined && response.Data[0] !== "") {
							try {
								let data = JSON.parse(JSON.stringify(response.Data[0]));
								$("#ddepOutboundResponseData").val(JSON.stringify(data, null, 4));
							} catch (err) {
								try {
									let xmlString;

									if (window.ActiveXObject) { // IE
										xmlString = response.Data[0].xml;
									} else { // code for Mozilla, Firefox, Opera, etc.
										xmlString = (new XMLSerializer()).serializeToString(response.Data[0]);
									}

									$("#ddepOutboundResponseData").val(xmlString);
								} catch (errr) {
									$("#ddepOutboundResponseData").val(response.Data[0]);
								}
							}
						}

						if (response.Data !== undefined && response.Data[1] !== undefined && response.Data[1] !== "") {
							try {
								let data = JSON.parse(JSON.stringify(response.Data[1]));
								console.log("outbound post data");
								console.log(data);
								$("#ddepOutboundPostData").val(JSON.stringify(data, null, 4));
							} catch (err) {
								try {
									let xmlString;

									if (window.ActiveXObject) { // IE
										xmlString = response.Data[1].xml;
									} else { // code for Mozilla, Firefox, Opera, etc.
										xmlString = (new XMLSerializer()).serializeToString(response.Data[1]);
									}

									$("#ddepOutboundPostData").val(xmlString);
								} catch (errr) {
									$("#ddepOutboundPostData").val(response.Data[1]);
								}
							}
						}
					} else {
						if (content_type.indexOf('json') > -1) {
							$("#ddepOutboundResponseData").val(JSON.stringify(response, null, 4));
						} else if (content_type.indexOf('xml') > -1) {
							let xmlString;

							if (window.ActiveXObject) { // IE
								xmlString = response.xml;
							} else { // code for Mozilla, Firefox, Opera, etc.
								xmlString = (new XMLSerializer()).serializeToString(response);
							}

							$("#ddepOutboundResponseData").val(xmlString);
						} else {
							$("#ddepOutboundResponseData").val(response);
						}
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				},
				error: function(textStatus, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});

					swal({
						title: "Error!",
						text: "Something went wrong!",
						type: "error",
						timer: 1200
					});

					return false;
				}
			});
		}
	});
}
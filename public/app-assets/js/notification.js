if ($("#frm-save-notification").length) {
	$("#frm-save-notification").validate({
		errorClass: "help-block animation-slideDown error",
		errorElement: "div",
		errorPlacement: function (error, e) {
			e.parents(".form-group").append(error);
		},
		highlight: function (e) {
			$(e).removeClass("success error").addClass("error");
			$(e).closest(".help-block").remove();
		},
		success: function (e) {
			e.removeClass("success error");
			e.closest(".help-block").remove();
		},
		Submit: function () {
		},
		rules: {
			providerName: {
				required: true
			}
		},
		messages: {
			providerName: {
				required: "Please enter provider name",
			}
		},
		submitHandler: function (e) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });

			let url = "/notifications/save";
			if ($("#data_id").val() != "") {
				url = "/notifications/update";
			}

			$.ajax({
				url: url,
				method: "post",
				dataType: "json",
				data: { data_id: $("#data_id").val(), providerName: $("#providerName").val(), email: $("#email").val(), email_failures_return_url: $("#email_failures_return_url").val(), response_failures_return_url: $("#response_failures_return_url").val(), isInboundFtpSuccess: $('input[name="isInboundFtpSuccess"]:checked').val(), isInboundFtpFail: $('input[name="isInboundFtpFail"]:checked').val(), isInboundDdepApiSuccess: $('input[name="isInboundDdepApiSuccess"]:checked').val(), isInboundDdepApiFail: $('input[name="isInboundDdepApiFail"]:checked').val(), isOutboundFtpSuccess: $('input[name="isOutboundFtpSuccess"]:checked').val(), isOutboundFtpFail: $('input[name="isOutboundFtpFail"]:checked').val(), isOutboundDdepApiSuccess: $('input[name="isOutboundDdepApiSuccess"]:checked').val(), isOutboundDdepApiFail: $('input[name="isOutboundDdepApiFail"]:checked').val(), companyCode: dataCompanyCode },
				success: function (response) {
					if (response.status == 1) {
						$("#data_id").val(response.id);
						swal({
							title: "Success!",
							text: response.message,
							type: "success",
							timer: 1200
						});
					} else {
						swal({
							title: "Error!",
							text: response.message,
							type: "error",
							timer: 1200
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({ 'display': 'none' });
						swal({
							title: "Error!",
							text: textStatus.responseJSON.message,
							type: "error",
							timer: 1200
						});
						return false;
					}
				}
			});
		}
	});
}
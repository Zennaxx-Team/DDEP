let diffHistoryCurrentPage = 1;
let diffHistoryPerPage = 50;;
let table = null;
let isSyncing = false;
let currentDiffData = null;
let diffLogDetailsData = null;
let diffDetailCurrentPage = 1;
let diffDetailPerPage = 50;
let diffViewLogsTable = null;


$(document).ready(async function () {
    if (!$('#diff-history-table').length) return;

    const timeOptions = {
        "30 minutes": 30,
        "60 minutes": 60,
        "3 hours": 180,
        "6 hours": 360,
        "12 hours": 720,
        "24 hours": 1440,
        "3 days": 4320,
        "7 days": 10080,
        "1 month": 43200,
        "3 months": 129600
    };

    const presetRanges = {};
    Object.entries(timeOptions).forEach(([label, minutes]) => {
        const end = moment().startOf('second');
        const start = moment(end).subtract(minutes, 'minutes');
        presetRanges[label] = [start, end];
    });

    // DEFAULT (only reason 3 months shows on refresh)
    const DEFAULT_LABEL = "3 months";
    let startMoment = moment().subtract(timeOptions[DEFAULT_LABEL], 'minutes').startOf('second');
    let endMoment = moment().startOf('second');

    let currentSelectedLabel = DEFAULT_LABEL

    $('#diffhistoryreportrange').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerSeconds: true,
        startDate: startMoment,
        endDate: endMoment,
        autoUpdateInput: false,
        locale: { format: 'MMMM D, YYYY HH:mm:ss' },
        ranges: presetRanges
    }, dateCallback);

    function matchPresetLabel(start, end) {
        const diffMinutes = Math.round(end.diff(start, 'minutes'));

        for (const [label, minutes] of Object.entries(timeOptions)) {
            // Allow small difference because of seconds rounding
            if (Math.abs(diffMinutes - minutes) <= 5) {
                return label;
            }
        }
        return null;
    }

    function updateDisplay(start, end, matchedLabel) {
        if (matchedLabel) {
            currentSelectedLabel = matchedLabel;
            $('#diffhistoryreportrange span').text(matchedLabel);
            $('.since-time-diff-history').text(matchedLabel);

            $('.ranges li').removeClass('active');
            $('.ranges li').each(function () {
                if ($(this).text().trim() === matchedLabel) {
                    $(this).addClass('active');
                }
            });
        } else {
            currentSelectedLabel = null;
            const displayText = `${start.format('MMMM D, YYYY HH:mm:ss')} - ${end.format('MMMM D, YYYY HH:mm:ss')}`;
            $('#diffhistoryreportrange span').text(displayText);
            $('.since-time-diff-history').text('Custom Range');
        }
    }

    function dateCallback(start, end) {
        alertFromDate = start.toISOString();
        alertToDate = end.toISOString();
        diffHistoryCurrentPage = 1;

        const matchedLabel = matchPresetLabel(start, end);

        updateDisplay(start, end, matchedLabel);

        getDiffHistory();
    }

    dateCallback(startMoment, endMoment);

    initDiffHistoryTable();

    $('#diffhistoryreportrange').on('apply.daterangepicker', function (ev, picker) {
        // If clicked on one of the ranges → we trust it's a preset
        const clickedLabel = picker.chosenLabel;

        if (clickedLabel && timeOptions[clickedLabel]) {
            // Force exact match behavior
            currentSelectedLabel = clickedLabel;
            updateDisplay(picker.startDate, picker.endDate, clickedLabel);
        } else {
            dateCallback(picker.startDate, picker.endDate);
        }

        getDiffHistory();
    });

    function initDiffHistoryTable() {
        if ($.fn.DataTable.isDataTable('#diff-history-table')) return;

        table = $('#diff-history-table').DataTable({
            paging: false,
            searching: true,
            info: false,
            ordering: false,
            autoWidth: false,
            language: {
                emptyTable: "No data available"
            },
            initComplete: function () {
                $('#diff-history-table_filter input')
                    .off()
                    .on('keyup', function (e) {
                        if (e.keyCode === 13) {
                            diffHistoryCurrentPage = 1;
                            getDiffHistory();
                        }
                    });
            }
        });
    }

    function getDiffHistory() {
        initDiffHistoryTable();

        if (!alertFromDate || !alertToDate) return;

        $('#diff-history-table tbody').html(
            '<tr><td colspan="11"><div class="tableloader"></div></td></tr>'
        );

        $.ajax({
            url: '/diff-history/list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                page: diffHistoryCurrentPage,
                limit: diffHistoryPerPage,
                search: $('#diff-history-table_filter input').val(),
                fromDate: alertFromDate,
                toDate: alertToDate
            }),
            success: function (response) {
                table.clear();

                let counter =
                    diffHistoryCurrentPage > 1
                        ? diffHistoryPerPage * (diffHistoryCurrentPage - 1) + 1
                        : 1;

                if (!response.data || !response.data.length) {
                    table.draw();
                    renderPagination(0);
                    return;
                }

                response.data.forEach(data => {
                    const rowNode = table.row.add([
                        counter++,
                        data?.ItemName || '',
                        data?._id || '',
                        data?.entrypointURL || '',
                        data?.type || '',
                        data?.totalDiffRow || '',
                        dateFormat(data.createdAt),
                    ]).draw(false).node();
                    $(rowNode).data('originalData', data);
                });

                $('#diff-history-table tbody').off('mouseenter mouseleave click'); // remove previous handlers
                $('#diff-history-table tbody').on('mouseenter', 'tr', function () {
                    $(this).css({
                        'background-color': '#8DC454',
                        'color': '#ffffff',
                        'cursor': 'pointer' // arrow pointer
                    });
                });
                $('#diff-history-table tbody').on('mouseleave', 'tr', function () {
                    $(this).css({
                        'background-color': '',
                        'color': '#6E6B7B',
                        'cursor': 'default'
                    });
                });

                $('#diff-history-table tbody').on('click', 'tr td:not(:first-child):not(:last-child)', function () {
                    const rowData = $(this).closest('tr').data('originalData');
                    openDetailsDiffChecker(rowData);
                });

                table.draw(false);
                renderPagination(response.total);
            },
            error: function (xhr) {
                Swal.fire({
                    title: 'Error!',
                    text: xhr?.responseJSON?.message || 'Something went wrong',
                    icon: 'error',
                    timer: 1200,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-primary' }
                });
            }
        });
    }

    function renderPagination(total) {
        const totalPages = Math.ceil(total / diffHistoryPerPage);
        let html = '';

        if (totalPages <= 1) {
            $('#diff-history-table_paginate').html('');
            return;
        }

        const prevDisabled = diffHistoryCurrentPage === 1 ? 'disabled' : '';
        const nextDisabled = diffHistoryCurrentPage === totalPages ? 'disabled' : '';

        html += `<a class="paginate_button ${prevDisabled}" data-pageno="${diffHistoryCurrentPage - 1}">Previous</a>`;

        for (let i = 1; i <= totalPages; i++) {
            html += i === diffHistoryCurrentPage
                ? `<a class="paginate_button current" data-pageno="${i}">${i}</a>`
                : `<a class="paginate_button" data-pageno="${i}">${i}</a>`;
        }

        html += `<a class="paginate_button ${nextDisabled}" data-pageno="${diffHistoryCurrentPage + 1}">Next</a>`;

        $('#diff-history-table_paginate').html(html);
    }

    $('body').on('click', '.paginate_button', function () {
        if ($(this).hasClass('disabled') || $(this).hasClass('current')) return;

        const page = $(this).data('pageno');
        if (!page) return;

        diffHistoryCurrentPage = parseInt(page);
        getDiffHistory();
    });

    $('body').on('change', '#diff-history-table_length select', function () {
        diffHistoryPerPage = parseInt($(this).val());
        diffHistoryCurrentPage = 1;
        getDiffHistory();
    });

    function openDetailsDiffChecker(rowData) {
        if (!rowData || !rowData._id) return;

        const diffId = rowData._id;

        $.ajax({
            url: `/diff-history/get/${diffId}`,
            method: 'POST',
            contentType: 'application/json',
            success: function (response) {
                if (!response.status) {
                    Swal.fire('Error', response.message || 'No data found', 'error');
                    return;
                }

                // response.data = record.diffs OR full record
                console.log('Diff details:', response.data);

                renderDiffDetails(response.data);
            },
            error: function (xhr) {
                Swal.fire({
                    title: 'Error!',
                    text: xhr?.responseJSON?.message || 'Failed to load diff details',
                    icon: 'error'
                });
            }
        });
    }

    function renderDiffDetails(data) {
        console.log(data, "datas");

        if (data) {
            currentDiffData = data;
            $('#diff-checker-detail-label-condition').text('Diff. Checker (' + (data?.ItemName || '') + ')');

            // Build HTML with proper spacing using Bootstrap classes
            let html = `
                <div class="mb-1 col-12 text-right">
                    <span>
                        <button type="button" class="btn btn-link p-0 m-0 me-1" onclick="viewHistoryLogDetails()">Source</button>
                    </span>
                </div>
                <div class="col-12 mb-1">
                    <table class="table table-bordered table-sm">
                        <tr>
                            <th class="py-1 px-2" width="30%">Item Name</th>
                            <td class="py-1 px-2">${data?.ItemName || '-'}</td>
                        </tr>
                        <tr>
                            <th class="py-1 px-2">Unique Id</th>
                           <td class="py-1 px-2">${data?.unique_id || '-'}</td>
                        </tr>
                        <tr>
                            <th class="py-1 px-2">Total Diff. Row</th>
                            <td class="py-1 px-2">${data?.totalDiffRow || '-'}</td>
                        </tr>
                        <tr>
                            <th class="py-1 px-2">Type</th>
                            <td class="py-1 px-2">${data?.type || '-'}</td>
                        </tr>
                        <tr>
                            <th class="py-1 px-2">Created Time</th>
                            <td class="py-1 px-2">${dateFormat(data?.createdAt)}</td>
                        </tr>
                    </table>
                </div>
            `;

            // Inject into modal section -> row
            $('#diff-checker-detail-modal-slide-in section .all-item').html(html);
            renderDetails(data);
        }

        $('#diff-checker-detail-modal-slide-in').modal('show');
    }

    async function renderDetails(data) {
        $('.editor-header-type').text(data.type === "Inbound" ? "Transformed Request" : "Transformed Response" || '');

        $('#left').val(data.template || '');
        $('#right').val(data.body || '');

        setTimeout(() => {
            updateLineNumbers('#leftLines', '#left');
            updateLineNumbers('#rightLines', '#right');
            runComparison();
        }, 300);
    }

    function updateLineNumbers(id, target) {
        try {
            const lines = $(target).val().split('\n').length;
            const html = Array.from({ length: lines }, (_, i) => `<div class="line-number-item">${i + 1}</div>`).join('');
            $(id).html(html);
        } catch (e) {
            console.error('Error updating line numbers:', e);
        }
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function detectChangeType(left, right) {
        const l = (left ?? "").toString().trim();
        const r = (right ?? "").toString().trim();

        if (l === r) return "unchanged";
        if (l && !r) return "removed";
        if (!l && r) return "added";
        return "modified";
    }

    function runComparison() {
        try {
            const leftText = $('#left').val() || '';
            const rightText = $('#right').val() || '';

            const leftLines = leftText.split('\n');
            const rightLines = rightText.split('\n');
            const maxLen = Math.max(leftLines.length, rightLines.length);

            const leftCol = document.getElementById('leftCol');
            const rightCol = document.getElementById('rightCol');
            leftCol.innerHTML = '';
            rightCol.innerHTML = '';

            const stats = {
                added: 0,
                removed: 0,
                modified: 0,
                unchanged: 0,
                total: maxLen
            };

            const rows = [];

            for (let i = 0; i < maxLen; i++) {
                const left = leftLines[i] ?? '';
                const right = rightLines[i] ?? '';
                const lineNo = i + 1;

                const changeType = detectChangeType(left, right);
                stats[changeType]++;

                let leftCls = 'unchanged', rightCls = 'unchanged';
                let leftMark = '', rightMark = '';

                if (changeType === 'added') {
                    rightCls = 'added';
                    rightMark = '+';
                } else if (changeType === 'removed') {
                    leftCls = 'removed';
                    leftMark = '−';
                } else if (changeType === 'modified') {
                    leftCls = 'removed';
                    rightCls = 'added';
                    leftMark = '−';
                    rightMark = '+';
                }

                rows.push({ lineNo, changeType, left, right });

                leftCol.insertAdjacentHTML('beforeend', `
                        <div class="line ${leftCls}">
                            <div class="marker ${leftMark === '−' ? 'minus' : ''}">${leftMark}</div>
                            <div class="ln">${lineNo}</div>
                            <div class="line-content">${escapeHtml(left)}</div>
                        </div>
                    `);

                rightCol.insertAdjacentHTML('beforeend', `
                        <div class="line ${rightCls}">
                            <div class="marker ${rightMark === '+' ? 'plus' : ''}">${rightMark}</div>
                            <div class="ln">${lineNo}</div>
                            <div class="line-content">${escapeHtml(right)}</div>
                        </div>
                    `);
            }

            $('#stats').html(
                `Added: ${stats.added} | Removed: ${stats.removed} | Modified: ${stats.modified} | Unchanged: ${stats.unchanged} | Total: ${stats.total}`
            );

            const statusEl = $('.modal.show').length ? $('#modalStatus') : $('#status');
            statusEl.text('✓ Comparison complete');

            $('#copyDiff').data('report', rows.map(r =>
                `${r.lineNo}: [${r.changeType}] LEFT="${r.left}" | RIGHT="${r.right}"`
            ).join('\n'));

            $('#exportJson').data('json', JSON.stringify({
                stats,
                rows,
                leftText,
                rightText
            }, null, 2));

        } catch (e) {
            console.error('Diff error:', e);
        }
    }

    function safeCopy(text) {
        if (!text) {
            diff('Nothing to copy');
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    const statusEl = $('.modal.show').length ? $('#modalStatus') : $('#status');
                    statusEl.text('✓ Copied');
                    setTimeout(() => statusEl.text(statusEl.attr('id') === 'modalStatus' ? 'Ready' : 'Ready'), 2000);
                })
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const temp = $('<textarea>').css({ position: 'fixed', top: '-9999px' });
        $('body').append(temp);
        temp.val(text).select();
        try {
            document.execCommand('copy');
            const statusEl = $('.modal.show').length ? $('#modalStatus') : $('#status');
            statusEl.text('✓ Copied');
            setTimeout(() => statusEl.text('Ready'), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
        temp.remove();
    }

    // Compare
    $(document).on('click', '#runDiff', function () {
        runComparison();
    });

    // Swap
    $(document).on('click', '#swapBtn', function () {
        const l = $('#left').val();
        const r = $('#right').val();
        $('#left').val(r);
        $('#right').val(l);
        updateLineNumbers('#leftLines', '#left');
        updateLineNumbers('#rightLines', '#right');
        runComparison();
    });

    // Copy buttons
    $(document).on('click', '#copyLeft', function () {
        safeCopy($('#left').val());
    });

    $(document).on('click', '#copyRight', function () {
        safeCopy($('#right').val());
    });

    $(document).on('click', '#copyDiff', function () {
        safeCopy($(this).data('report') || '');
    });

    // Export
    $(document).on('click', '#exportJson', function () {
        const json = $(this).data('json') || '{}';
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diff.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    function syncScroll(source, target) {
        if (isSyncing) return;
        isSyncing = true;

        target.scrollTop(source.scrollTop());
        target.scrollLeft(source.scrollLeft());

        setTimeout(() => { isSyncing = false; }, 10);
    }

    $('#leftCol').on('scroll', () => syncScroll($('#leftCol'), $('#rightCol')));
    $('#rightCol').on('scroll', () => syncScroll($('#rightCol'), $('#leftCol')));

    // Scroll sync
    $('#left').on('scroll', function () {
        $('#leftLines').scrollTop(this.scrollTop);
    });

    $('#right').on('scroll', function () {
        $('#rightLines').scrollTop(this.scrollTop);
    });

    $(document).on('input', '#left', function () {
        updateLineNumbers('#leftLines', '#left');
        runComparison();
    });

    $(document).on('input', '#right', function () {
        updateLineNumbers('#rightLines', '#right');
        runComparison();
    });

    updateLineNumbers('#leftLines', '#left');
    updateLineNumbers('#rightLines', '#right');
    runComparison();
});

async function viewHistoryLogDetails() {
    if (!currentDiffData) return;

    await getDiffHistoryDetailsLogs(currentDiffData.unique_id);
    initDiffLogsTable();
    await getDiffDetailHistorycondition(
        parseInt(diffDetailPerPage),
        parseInt(diffDetailCurrentPage)
    );
    $('#diff-history-logs-view-model-slide-in').modal('show');
}

if ($('#diff-history-logs-view-table').length) {
    diffDetailPerPage = 50;
    diffDetailCurrentPage = 1;
    initDiffLogsTable();

    $('body').on('click', '#diff-history-logs-view-table_paginate .paginate_button', async function () {
        diffDetailCurrentPage = $(this).attr('data-pageno');
        await getDiffHistoryDetailsLogs(currentDiffData?.unique_id)
        initDiffLogsTable();
        await getDiffDetailHistorycondition(parseInt(diffDetailPerPage), parseInt(diffDetailCurrentPage));
        $('#diff-history-logs-view-model-slide-in').modal('show');
    });

    $('body').on('change', '#diff-history-logs-view-table_length select', async function () {
        diffDetailPerPage = $('#diff-history-logs-view-table_length select').val();
        diffDetailCurrentPage = 1;
        await getDiffHistoryDetailsLogs(currentDiffData?.unique_id)
        initDiffLogsTable();
        await getDiffDetailHistorycondition(parseInt(diffDetailPerPage), parseInt(diffDetailCurrentPage));
    });
}

function initDiffLogsTable() {
    if ($.fn.DataTable.isDataTable('#diff-history-logs-view-table')) {
        diffViewLogsTable = $('#diff-history-logs-view-table').DataTable();
        return;
    }

    diffViewLogsTable = $('#diff-history-logs-view-table').DataTable({
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        iDisplayLength: diffDetailPerPage,
        pagingType: 'full_numbers',
        searching: true,
    });
}

function getDiffHistoryDetailsLogs(unique_id) {
    return $.ajax({
        url: '/diff-history/' + unique_id,
        method: 'GET',
        contentType: 'application/json'
    }).then(response => {
        console.log(response, "response");
        diffLogDetailsData = response.data || [];
        return diffLogDetailsData;
    }).catch(xhr => {
        Swal.fire({
            title: 'Error!',
            text: xhr?.responseJSON?.message || 'Something went wrong',
            icon: 'error',
            timer: 1200,
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-primary' }
        });
        diffLogDetailsData = [];
        return [];
    });
}


async function getDiffDetailHistorycondition(diffDetailPerPage, diffDetailCurrentPage) {
    $('#diff-history-logs-view-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

    let counter = (parseInt(diffDetailCurrentPage) > 1) ? ((parseInt(diffDetailPerPage) * (parseInt(diffDetailCurrentPage) - 1)) + 1) : 1;
    let totalRecord = diffLogDetailsData ? diffLogDetailsData.length : 0;

    if (diffLogDetailsData === undefined || diffLogDetailsData.length <= 0) {
        $('#diff-history-logs-view-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
    }

    diffViewLogsTable.clear();

    $.each(diffLogDetailsData, function (index, data) {
        const startDate = new Date(data.createdAt);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth() + 1;
        const startDay = startDate.getDate();
        const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
        const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
        const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
        const startMilliseconds = startDate.getMilliseconds();
        const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds;

        let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
        if (data.datas && data.datas !== "") {
            $button_group += '<button type="button" class="btn btn-outline-secondary view-details-btn" data-toggle="tooltip" title="View" data-alert-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
        }
        $button_group += '</div>';

        diffViewLogsTable.row.add([
            counter++,
            data.action,
            data.description,
            data.type,
            data.httpStatus || '',
            startTime,
            $button_group
        ])
    });

    diffViewLogsTable.draw(false);

    $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
    let startEntry = (parseInt(diffDetailCurrentPage) == 1) ? 1 : ((parseInt(diffDetailPerPage) * (parseInt(diffDetailCurrentPage) - 1)) + 1);
    let endEntry = (parseInt(diffDetailCurrentPage) == 1) ? parseInt(diffDetailPerPage) : (parseInt(diffDetailPerPage) * parseInt(diffDetailCurrentPage));
    endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

    if (totalRecord == 0) {
        startEntry = 0;
    }

    let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
    $('body').find('#diff-history-logs-view-table_info').html(showpage);

    let dataDtIdx = 0;
    let paginationHtml = '';
    let firstDisable = (parseInt(diffDetailCurrentPage) == 1) ? 'disabled' : '';
    let lastDisable = (parseInt(diffDetailCurrentPage) == Math.ceil(totalRecord / parseInt(diffDetailPerPage))) ? 'disabled' : '';

    if (Math.ceil(totalRecord / parseInt(diffDetailPerPage)) > 0) {
        paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_first_1" data-pageno="1">First</a>';
        dataDtIdx++;
        paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_previous_1" data-pageno="' + (parseInt(diffDetailCurrentPage) - 1) + '">Previous</a>';
        paginationHtml += '<span>';
        dataDtIdx++;

        if (parseInt(diffDetailCurrentPage) > 2) {
            paginationHtml += '<a class="paginate_button" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
            if (parseInt(diffDetailCurrentPage) > 3) {
                paginationHtml += '<span class="ellipsis">...</span>';
            }
            dataDtIdx++;
        }

        if ((parseInt(diffDetailCurrentPage) - 1) > 0) {
            paginationHtml += '<a class="paginate_button" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(diffDetailCurrentPage) - 1) + '">' + (parseInt(diffDetailCurrentPage) - 1) + '</a>';
            dataDtIdx++;
        }

        paginationHtml += '<a class="paginate_button current" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(diffDetailCurrentPage) + '">' + parseInt(diffDetailCurrentPage) + '</a>';
        dataDtIdx++;

        if ((parseInt(diffDetailCurrentPage) + 1) < Math.ceil(totalRecord / parseInt(diffDetailPerPage)) + 1) {
            paginationHtml += '<a class="paginate_button" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(diffDetailCurrentPage) + 1) + '">' + (parseInt(diffDetailCurrentPage) + 1) + '</a>';
            dataDtIdx++;
        }

        if (parseInt(diffDetailCurrentPage) < Math.ceil(totalRecord / parseInt(diffDetailPerPage)) - 1) {
            if (((parseInt(diffDetailCurrentPage) + 3) < Math.ceil(totalRecord / parseInt(diffDetailPerPage)) + 1)) {
                paginationHtml += '<span class="ellipsis">...</span>';
            }
            paginationHtml += '<a class="paginate_button" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(diffDetailPerPage)) + '">' + Math.ceil(totalRecord / parseInt(diffDetailPerPage)) + '</a>';
            dataDtIdx++;
        }

        paginationHtml += '</span>';
        paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="diff-history-logs-view-table_next_1" data-pageno="' + (parseInt(diffDetailCurrentPage) + 1) + '">Next</a>';
        dataDtIdx++;
        paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="diff-history-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="diff-history-logs-view-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(diffDetailPerPage)) + '">Last</a>';
    }

    $('body').find('#diff-history-logs-view-table_paginate').html(paginationHtml);
}

$('body').on('click', 'button[data-alert-uniqueId]', function (event) {
    event.preventDefault();
    const uniqueId = $(this).attr('data-alert-uniqueId');
    const dataObject = diffLogDetailsData.find(item => item._id === uniqueId);
    let datas;
    try {
        datas = JSON.parse(dataObject.datas);
    } catch (e) {
        datas = dataObject.datas;
    }
    console.log(datas, "datas");
    const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
    $('#details-modal-body').text(formattedData);
    if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
        $('#copy-content-btn').show();
    } else {
        $('#copy-content-btn').hide();
    }
    $('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
    $('#details-modal-body').show();
    $('#table-content').hide();
    $('#view-item-logs-details-modal-slide-in').modal('show');
});

$('#copy-content-btn').on('click', function () {
    let curlRequest = $('#log-req-res-request').attr('data-uniqueid-curl-request');
    navigator.clipboard.writeText(curlRequest)
        .then(() => {
            Swal.fire({
                title: 'Success!',
                text: "Request copied to clipboard",
                icon: 'success',
                customClass: {
                    confirmButton: 'btn btn-primary'
                },
                buttonsStyling: false,
                timer: 1200
            });
        })
        .catch(err => {
            Swal.fire({
                title: 'Error!',
                text: err.message,
                icon: 'error',
                customClass: {
                    confirmButton: 'btn btn-primary'
                },
                buttonsStyling: false,
                timer: 1200
            });
        });
});
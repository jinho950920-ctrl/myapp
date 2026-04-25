const fs = require('fs');
const xlsx = require('xlsx');

function formatOrders(ordersData) {
  if (!ordersData || !Array.isArray(ordersData)) return [];
  return ordersData.map(item => {
    const o = item.order || {};
    const p = item.productOrder || {};
    const d = item.delivery || {};
    const s = p.shippingAddress || {};
    return {
      '분류': '주문상세',
      '주문번호': o.orderId,
      '상품주문번호': p.productOrderId,
      '주문일시': o.orderDate,
      '결제일시': o.paymentDate,
      '주문상태': p.productOrderStatus,
      '구매자명': o.ordererName,
      '구매자연락처': o.ordererTel,
      '수취인명': s.name,
      '수취인연락처': s.tel1,
      '배송지주소': s.baseAddress ? `${s.baseAddress} ${s.detailedAddress || ''}` : '',
      '우편번호': s.zipCode,
      '상품명': p.productName,
      '옵션명': p.productOption,
      '수량': p.quantity,
      '상품단가': p.unitPrice,
      '총상품금액': p.totalProductAmount,
      '고객결제금액': p.totalPaymentAmount,
      '배송비': p.deliveryFeeAmount,
      '결제수수료': p.paymentCommission,
      '예상정산금액(정수)': p.expectedSettlementAmount,
      '택배사': d.deliveryCompany,
      '송장번호': d.trackingNumber,
      '발송일시': d.sendDate,
      '배송완료일시': d.deliveredDate
    };
  });
}

function formatSettlement(settleData) {
  // 정산 데이터는 리스트형태일수도 있고 객체일수도 있습니다. 배열로 추출.
  let list = [];
  if (Array.isArray(settleData)) {
    list = settleData;
  } else if (settleData && Array.isArray(settleData.data)) {
    list = settleData.data;
  } else if (settleData && settleData.data && Array.isArray(settleData.data.content)) {
    list = settleData.data.content;
  }
  
  return list.map(item => {
    return {
      '분류': '정산내역',
      '정산일자': item.settleDate || item.date || item.baseDate,
      '상품주문번호': item.productOrderId || '',
      '결제금액': item.payAmount || item.paymentAmount || '',
      '정산대상금액': item.settleAmount || item.settledAmount || '',
      '차감수수료': item.commissionAmount || item.totalCommission || '',
      '원시데이터': JSON.stringify(item).substring(0, 200)
    };
  });
}

function formatQna(qnaData) {
  let list = [];
  if (Array.isArray(qnaData)) list = qnaData;
  else if (qnaData && Array.isArray(qnaData.data)) list = qnaData.data;
  else if (qnaData && qnaData.data && Array.isArray(qnaData.data.content)) list = qnaData.data.content;

  return list.map(item => {
    return {
      '작성일시': item.createDate || item.registerDate,
      '문의유형': item.questionType || item.inquiryType,
      '문의제목': item.subject || item.title || '',
      '문의내용': item.questionContent || item.content || '',
      '작성자명': item.writerName || item.writerId || '',
      '답변상태': item.answerStatus || item.status,
      '스마트스토어상품번호': item.productId || item.channelProductNo || '',
      '비밀글여부': item.isSecret ? 'Y' : 'N'
    };
  });
}

try {
  const rawJson = fs.readFileSync('downloads/naver_api_test_results.json', 'utf8');
  const data = JSON.parse(rawJson);

  const wb = xlsx.utils.book_new();

  // 1. 주문 상세 조회
  const orderSheetData = formatOrders(data['주문상세조회(최대50건)']?.data);
  const orderSheet = xlsx.utils.json_to_sheet(orderSheetData.length > 0 ? orderSheetData : [{'데이터': '없음'}]);
  xlsx.utils.book_append_sheet(wb, orderSheet, "1. 주문상세내역");

  // 2. 정산내역
  const settleSheetData = formatSettlement(data['정산내역(3일전)']);
  const settleSheet = xlsx.utils.json_to_sheet(settleSheetData.length > 0 ? settleSheetData : [{'데이터': '없음(또는 에러)'}]);
  xlsx.utils.book_append_sheet(wb, settleSheet, "2. 일별정산내역");

  // 3. 고객 문의 (QnA)
  const qnaSheetData = formatQna(data['최근_고객문의QNA']);
  const qnaSheet = xlsx.utils.json_to_sheet(qnaSheetData.length > 0 ? qnaSheetData : [{'데이터': '없음(또는 에러)'}]);
  xlsx.utils.book_append_sheet(wb, qnaSheet, "3. 고객QnA내역");

  const exportPath = 'downloads/네이버_API_데이터분석.xlsx';
  xlsx.writeFile(wb, exportPath);
  console.log('✅ 완료! 엑셀 파일이 저장되었습니다:', exportPath);
} catch (e) {
  console.error('엑셀 생성 중 에러 발생:', e);
}

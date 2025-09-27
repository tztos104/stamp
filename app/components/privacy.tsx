// app/components/PrivacyPolicyContent.tsx (전체 코드)

export function PrivacyPolicyContent() {
  return (
    // 전체적인 타이포그래피와 간격을 위해 prose 클래스를 유지하되, 세부 스타일을 추가합니다.
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground">
      
      <div>
        <h3 className="font-bold text-base mb-2">제1조 (총칙)</h3>
        <p className="text-muted-foreground">
          티씨룸(TCRoom)(이하 '회사'라 함)은 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법령상의 개인정보보호 규정을 준수하며, 관련 법령에 의거한 개인정보처리방침을 정하여 이용자 권익 보호에 최선을 다하고 있습니다.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제2조 (개인정보의 수집 항목 및 이용 목적)</h3>
        <p className="text-muted-foreground">회사는 다음의 목적을 위하여 최소한의 개인정보를 수집하여 이용합니다.</p>
        <div className="space-y-4 rounded-md border bg-muted/50 p-4 not-prose mt-2">
          <div>
            <h4 className="font-semibold text-foreground">수집 항목</h4>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
              <li><strong>필수 항목:</strong> 휴대전화 번호, 이름, 비밀번호</li>
              <li><strong>자동 생성 정보:</strong> 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보, 스탬프 적립/사용 기록, 쿠폰 발급/사용 기록</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">이용 목적</h4>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
              <li>회원 식별 및 본인 확인, 서비스 회원가입 및 로그인 기능 제공</li>
              <li>서비스 제공(활동 후 스탬프 발급, 스탬프 개수에 따른 쿠폰 지급 등)에 관한 계약 이행</li>
              <li>휴대전화 번호를 통한 알림톡 발송 (서비스 관련 핵심 정보 안내)</li>
              <li>고객 상담 및 불만 처리 등 원활한 의사소통 경로 확보</li>
              <li>서비스 부정 이용 방지 및 비인가 사용 방지</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제3조 (개인정보의 보유 및 이용 기간)</h3>
        <p className="text-muted-foreground">회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.</p>
         <div className="space-y-4 rounded-md border bg-muted/50 p-4 not-prose mt-2">
            <div>
                <h4 className="font-semibold text-foreground">회사 내부 방침에 의한 정보 보유 사유</h4>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                    <li>부정 이용 기록(부정한 스탬프/쿠폰 획득 등): 부정 이용 방지를 위해 회원 탈퇴 후 1년간 보관</li>
                </ul>
            </div>
            <div>
                <h4 className="font-semibold text-foreground">관련 법령에 의한 정보 보유 사유</h4>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                    <li><strong>전자상거래법:</strong> 계약 또는 청약철회 기록 (5년), 대금결제 및 공급 기록 (5년), 소비자 불만/분쟁 처리 기록 (3년)</li>
                    <li><strong>통신비밀보호법:</strong> 로그인 기록 (3개월)</li>
                </ul>
            </div>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제4조 (개인정보의 제3자 제공)</h3>
        <p className="text-muted-foreground">회사는 이용자의 개인정보를 제2조에서 고지한 범위 내에서 사용하며, 이용자의 사전 동의 없이는 동 범위를 초과하여 이용하거나 원칙적으로 이용자의 개인정보를 외부에 공개하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
            <li>이용자들이 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제5조 (개인정보 처리의 위탁)</h3>
        <p className="text-muted-foreground">회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 관계 법령에 따라 위탁계약 시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있습니다.</p>
        <div className="rounded-md border bg-muted/50 p-4 not-prose mt-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold text-foreground">수탁업체:</dt>
            <dd className="text-muted-foreground">(알림톡 발송 대행업체명 기재, 예: 카카오)</dd>
            <dt className="font-semibold text-foreground">위탁업무 내용:</dt>
            <dd className="text-muted-foreground">스탬프 및 쿠폰 발급 내역 알림톡 발송</dd>
            <dt className="font-semibold text-foreground">보유 및 이용기간:</dt>
            <dd className="text-muted-foreground">위탁계약 종료 시 또는 위탁업무 목적 달성 시까지</dd>
          </dl>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제6조 (정보주체의 권리·의무 및 그 행사방법)</h3>
        <p className="text-muted-foreground">
          이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 가입 해지를 요청할 수도 있습니다. 개인정보 조회, 수정을 위해서는 서비스 내 '회원정보수정'을, 가입 해지(동의 철회)를 위해서는 '회원탈퇴'를 클릭하여 본인 확인 절차를 거치신 후 직접 열람, 정정 또는 탈퇴가 가능합니다. 혹은 개인정보보호책임자에게 서면, 전화 또는 이메일로 연락하시면 지체 없이 조치하겠습니다.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제7조 (개인정보 보호책임자)</h3>
        <p className="text-muted-foreground">회사는 고객의 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 관련 부서 및 개인정보 보호책임자를 지정하고 있습니다.</p>
        <div className="rounded-md border bg-muted/50 p-4 not-prose mt-2">
           <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="font-semibold text-foreground">책임자:</dt>
              <dd className="text-muted-foreground">이영준</dd>
              <dt className="font-semibold text-foreground">이메일:</dt>
              <dd className="text-muted-foreground">kasean@nate.com</dd>
              <dt className="font-semibold text-foreground">전화번호:</dt>
              <dd className="text-muted-foreground">010-2311-2390</dd>
           </dl>
        </div>
      </div>
      
      <div>
        <h3 className="font-bold text-base mb-2">제8조 (고지의 의무)</h3>
        <p className="text-muted-foreground">
          현 개인정보처리방침 내용 추가, 삭제 및 수정이 있을 시에는 개정 최소 7일 전부터 서비스 내 '공지사항'을 통해 고지할 것입니다.
        </p>
      </div>
      
      <div className="text-xs text-muted-foreground border-t pt-4 mt-8">
          <p>공고일자: 2025년 09월 27일</p>
          <p>시행일자: 2025년 09월 27일</p>
      </div>

    </div>
  );
}
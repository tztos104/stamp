// app/components/TermsOfServiceContent.tsx

export function TermsOfServiceContent() {
   return (
    // 전체적인 타이포그래피와 간격을 위해 prose 클래스를 사용합니다.
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground">
      
      <div>
        <h3 className="font-bold text-base mb-2">제1조 (목적)</h3>
        <p className="text-muted-foreground">
          이 약관은 티씨룸(TCRoom)(이하 '회사')가 제공하는 활동 기반 스탬프 및 쿠폰 서비스(이하 '서비스')의 이용과 관련하여 회사와 회원과의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제2조 (정의)</h3>
        <div className="rounded-md border bg-muted/50 p-4 not-prose mt-2">
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li><strong>서비스:</strong> 구현되는 단말기(PC, 모바일 등)와 상관없이 회원이 이용할 수 있는 티씨룸(TCRoom) 및 관련 제반 서비스를 의미합니다.</li>
                <li><strong>회원:</strong> 회사의 서비스에 접속하여 이 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.</li>
                <li><strong>아이디(ID):</strong> 회원의 식별과 서비스 이용을 위하여 회원의 휴대전화 번호를 사용합니다.</li>
                <li><strong>비밀번호:</strong> 회원 자신이 정한 문자 또는 숫자의 조합을 의미합니다.</li>
                <li><strong>스탬프:</strong> 회원이 회사가 지정한 활동을 완료하였을 경우 회사가 부여하는 전자적 증표를 의미합니다.</li>
                <li><strong>쿠폰:</strong> 스탬프를 회사가 정한 기준만큼 모았을 경우, 회원에게 지급되는 혜택을 받을 수 있는 전자적 증표를 의미합니다.</li>
            </ul>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제4조 (회사의 의무)</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>회사는 관련법과 이 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다하여 노력합니다.</li>
            <li>회사는 회원이 안전하게 서비스를 이용할 수 있도록 개인정보(신용정보 포함)보호를 위해 보안시스템을 갖추어야 하며 개인정보처리방침을 공시하고 준수합니다.</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제5조 (회원의 의무)</h3>
        <p className="text-muted-foreground">회원은 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
            <li>신청 또는 변경 시 허위 내용의 등록</li>
            <li>타인의 정보(특히 휴대전화 번호) 도용</li>
            <li>부정한 방법으로 스탬프나 쿠폰을 취득하거나 사용하는 행위</li>
            <li>회사가 게시한 정보의 변경</li>
            <li>회사 및 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
            <li>기타 불법적이거나 부당한 행위</li>
        </ul>
      </div>
      
      <div>
        <h3 className="font-bold text-base mb-2">제7조 (스탬프 및 쿠폰에 관한 규정)</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>스탬프는 회사가 정한 기준(예: 10개)에 도달하면 자동으로 쿠폰으로 전환되며, 전환된 스탬프는 소멸됩니다.</li>
            <li>스탬프와 쿠폰은 현금으로 환급되거나 타인에게 양도할 수 없습니다.</li>
            <li>부정한 방법으로 스탬프나 쿠폰을 취득한 사실이 확인될 경우, 회사는 이를 회수하고 서비스 이용을 제한할 수 있습니다.</li>
            <li>스탬프 및 쿠폰의 유효기간은 회사가 별도로 정하여 공지하며, 유효기간이 경과하면 자동으로 소멸됩니다.</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제8조 (계약해지 및 이용제한)</h3>
        <p className="text-muted-foreground">
          회원은 언제든지 서비스 내 '회원탈퇴' 기능을 통하여 이용계약 해지를 신청할 수 있으며, 탈퇴 시 보유하고 있던 스탬프 및 쿠폰은 복구 불가능하며 자동으로 소멸됩니다.
        </p>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제9조 (면책조항)</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.</li>
          <li>회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.</li>
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-base mb-2">제10조 (준거법 및 재판관할)</h3>
        <p className="text-muted-foreground">
          회사와 회원 간에 제기된 소송은 대한민국법을 준거법으로 하며, 분쟁에 관한 소송은 서울중앙지방법원을 관할 법원으로 합니다.
        </p>
      </div>

      <div className="text-xs text-muted-foreground border-t pt-4 mt-8">
          <p>공고일자: 2025년 09월 27일</p>
          <p>시행일자: 2025년 09월 27일</p>
      </div>

    </div>
  );
}
// app/components/ParticipantManager.tsx (검색 버튼 방식 최종본)

import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X, UserPlus, Ticket, Search, CalendarIcon } from "lucide-react"; 
import { toast } from "sonner";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { DatePicker } from "@mui/x-date-pickers";
import type dayjs from "dayjs";


export type Participant = {
  type: 'user' | 'temp-phone' | 'temp-code';
  id: string;
  name: string;
  detail: string;
  maxUses?: number | null;
  expiryOption?: 'event_end' | 'one_day' | 'three_days' | 'custom';
  customExpiryDate?: string | null; // ISO string으로 저장
};

type User = {
    id: string;
    name: string;
    phoneNumber: string;
}

export function ParticipantManager({ participants, setParticipants }: {
    participants: Participant[];
    setParticipants: (participants: Participant[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [expiryOption, setExpiryOption] = useState<Participant['expiryOption']>("one_day"); 
   const [customExpiryDate, setCustomExpiryDate] = useState<Date | null>(new Date()); 
  const [tempCodeMaxUses, setTempCodeMaxUses] = useState<number | null>(1); 
  const [isUnlimited, setIsUnlimited] = useState(false); 

  const searchFetcher = useFetcher<{ users: User[] }>();
  const phoneCheckFetcher = useFetcher<{ exists: boolean, isUser: boolean }>();

  const handleSearch = () => {
    if (searchQuery.length > 1) {
      searchFetcher.load(`/api/users/search?q=${searchQuery}`);
    } else {
        toast.info("검색어는 2글자 이상 입력해주세요.");
    }
  };

  const addParticipant = (participant: Participant) => {
    if (!participants.some(p => p.id === participant.id)) {
      setParticipants([...participants, participant]);
    } else {
      toast.warning("이미 추가된 참가자입니다.");
    }
    setSearchQuery("");
  };
  
  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  // '전화번호로 추가' 버튼 로직 수정
  const addTempUserByPhone = () => {
    const cleanPhone = phone.trim().replace(/-/g, "");
    if (!cleanPhone.match(/^\d{10,11}$/)) {
      toast.error("올바른 전화번호 형식을 입력해주세요.");
      return;
    }
    if (participants.some(p => p.id === cleanPhone)) {
        toast.warning("이미 추가된 참가자입니다.");
        return;
    }
    
    phoneCheckFetcher.load(`/api/users/check?phone=${cleanPhone}`);
  };

 
  useEffect(() => {
    // data가 없거나, fetcher가 idle 상태가 아니면 아무것도 하지 않음
    if (phoneCheckFetcher.state !== 'idle' || !phoneCheckFetcher.data) {
        return;
    }
    
    if (phoneCheckFetcher.data.exists) {
        toast.error("이미 등록된 회원입니다. 상단의 회원 검색을 이용해주세요.");
         
        setPhone("");
    } else {
        const cleanPhone = phone.trim().replace(/-/g, "");
        const success = addParticipant({
            type: 'temp-phone',
            id: cleanPhone,
            name: name || `임시회원-${cleanPhone.slice(-4)}`,
            detail: cleanPhone,
        });
        // 추가에 성공했을 때만 입력창을 비웁니다.
        
            setName("");
            setPhone("");
        
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneCheckFetcher.data, phoneCheckFetcher.state]); 

  const addTempUserByCode = () => {
      const code = `CODE-${Date.now().toString(36).toUpperCase()}`;
      addParticipant({
          type: 'temp-code',
          id: code,
          name: '임시 코드 발급',
          detail: `최대 ${isUnlimited ? '무제한' : `${tempCodeMaxUses}회`} 사용`, 
          maxUses: isUnlimited ? null : tempCodeMaxUses, 
          expiryOption: expiryOption,
          customExpiryDate: expiryOption === 'custom' && customExpiryDate ? customExpiryDate.toISOString() : null,
      });
  }
 useEffect(() => {
    if (isUnlimited) {
      setTempCodeMaxUses(null);
    } else if (tempCodeMaxUses === null) {
      setTempCodeMaxUses(1); // 무제한 해제 시 기본 1회로 설정
    }
  }, [isUnlimited])
  return (
    <div className="space-y-4">
      {/* 참가자 목록 UI */}
      <div className="p-4 border rounded-lg space-y-2 min-h-[80px]">
        {participants.map(p => (
          <Badge key={p.id} variant="secondary" className="mr-2 mb-2 text-xs">
            {p.name}({p.detail})
            <button onClick={() => removeParticipant(p.id)} className="ml-2 rounded-full hover:bg-muted p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {participants.length === 0 && <p className="text-sm text-muted-foreground">아래에서 참가자를 추가해주세요.</p>}
      </div>

      {/* --- 회원 검색 UI 수정 --- */}
      <div className="space-y-2">
          <Label>회원 검색</Label>
          <div className="flex gap-2">
            <Input 
                placeholder="이름 또는 전화번호로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }}}
            />
            <Button type="button" onClick={handleSearch}>
                <Search className="h-4 w-4"/>
            </Button>
          </div>
          {/* 검색 결과는 CommandList를 활용하여 보여줌 */}
          {searchFetcher.state !== 'idle' || searchFetcher.data ? (
             <Command className="rounded-lg border shadow-md mt-2">
                <CommandList>
                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                {searchFetcher.state === 'loading' && <div className="p-4 text-sm">검색 중...</div>}
                {searchFetcher.data?.users && (
                    <CommandGroup className="text-xs" heading="검색된 회원">
                    {searchFetcher.data.users.map(user => (
                        <CommandItem key={user.id} onSelect={() => addParticipant({
                            type: 'user',
                            id: user.id,
                            name: user.name,
                            detail: user.phoneNumber,
                        })}>
                        {user.name} ({user.phoneNumber})
                        </CommandItem>
                    ))}
                    </CommandGroup>
                )}
                </CommandList>
            </Command>
          ) : null}
      </div>
      {/* --- UI 수정 끝 --- */}

      {/* 비회원 등록 UI */}
      <div className="space-y-2">
        <Label>비회원 등록</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
           <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (선택)"/>
           <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="전화번호 (필수)"/>
        </div>
        <Button type="button" onClick={addTempUserByPhone} className="w-full" disabled={phoneCheckFetcher.state !== 'idle'}>
            {phoneCheckFetcher.state !== 'idle' ? '확인 중...' : <><UserPlus className="mr-2 h-4 w-4"/> 전화번호로 추가</>}
        </Button>
      </div>
      
      {/* 임시 코드 발급 */}
       <div className="space-y-2 mt-4 border-t pt-4">
        <Label className="font-semibold">임시 스탬프 코드 발급</Label>
        <div className="flex items-center gap-2 mt-2">
          {/* Popover를 사용하여 횟수 설정 UI를 만듭니다. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-[120px] justify-start">
                {isUnlimited ? '무제한' : `${tempCodeMaxUses}회`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="unlimited-switch">무제한 사용</Label>
                <Switch 
                  id="unlimited-switch"
                  checked={isUnlimited}
                  onCheckedChange={setIsUnlimited}
                />
              </div>
              {!isUnlimited && (
                <div>
                  <Label htmlFor="max-uses-input">사용 횟수</Label>
                  <Input
                    id="max-uses-input"
                    type="number"
                    min="1"
                    value={tempCodeMaxUses ?? 1} // null일 경우 1로 표시
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setTempCodeMaxUses(isNaN(value) || value < 1 ? 1 : value); // 1 미만 숫자 방지
                    }}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>
           {/* 유효 기간 설정 Select */}
          <Select value={expiryOption} onValueChange={(value) => setExpiryOption(value as Participant['expiryOption'])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="유효기간 선택..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="event_end">이벤트 종료일</SelectItem>
              <SelectItem value="one_day">종료일 +1일</SelectItem>
              <SelectItem value="three_days">종료일 +3일</SelectItem>
              <SelectItem value="custom">직접 지정</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* '직접 지정' 선택 시 날짜 선택 UI */}
        {expiryOption === 'custom' && (
          <div className="mt-2"> {/* 마진 추가 */}
            <DatePicker
              label="만료 날짜 선택"
              value={customExpiryDate} // Date 객체 또는 null
              onChange={(newValue) => setCustomExpiryDate(newValue as Date)}
              minDate={new Date()} // 오늘 이전 날짜 비활성화
              slotProps={{
                textField: {
                  fullWidth: true, // 너비를 꽉 채우도록
                  size: "small",   // 크기를 작게
                  // Tailwind CSS 클래스를 추가하고 싶다면 sx prop 사용
                  sx: {
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '0.5rem', // shadcn/ui의 border-radius와 유사하게
                    },
                    '& .MuiInputLabel-root': {
                      // 라벨 스타일 조정
                    },
                  }
                },
              }}
              localeText={{
                cancelButtonLabel: "취소",
                okButtonLabel: "확인",
                todayButtonLabel: "오늘",
                // 다른 텍스트도 커스텀 가능
              }}
            />
          </div>
        )}
          <Button type="button" onClick={addTempUserByCode} className="flex-grow">
            <Ticket className="mr-2 h-4 w-4"/> 임시 스탬프 코드 발급 및 추가
          </Button>
        </div>
       
      </div>
   
  );
}
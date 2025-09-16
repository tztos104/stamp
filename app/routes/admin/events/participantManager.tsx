// app/components/ParticipantManager.tsx (검색 버튼 방식 최종본)

import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { X, UserPlus, Ticket, Search } from "lucide-react"; 
import { toast } from "sonner";
import { Label } from "~/components/ui/label";

export type Participant = {
  type: 'user' | 'temp-phone' | 'temp-code';
  id: string;
  name: string;
  detail: string;
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
    if (phoneCheckFetcher.state === 'idle' && phoneCheckFetcher.data) {
        const cleanPhone = phone.trim().replace(/-/g, "");
        if (phoneCheckFetcher.data.exists) {
            toast.error("이미 등록된 회원입니다. 상단의 회원 검색을 이용해주세요.");
        } else {
            addParticipant({
                type: 'temp-phone',
                id: cleanPhone,
                name: name || `임시회원-${cleanPhone.slice(-4)}`,
                detail: cleanPhone,
            });
            setName("");
            setPhone("");
        }
    }
  }, [phoneCheckFetcher.state, phoneCheckFetcher.data]);

  const addTempUserByCode = () => {
      const code = `CODE-${Date.now().toString(36).toUpperCase()}`;
      addParticipant({
          type: 'temp-code',
          id: code,
          name: '임시 코드 발급',
          detail: code,
      });
  }

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
      <Button type="button" variant="outline" onClick={addTempUserByCode} className="w-full">
          <Ticket className="mr-2 h-4 w-4"/> 전화번호 모를 시 임시 코드 발급
      </Button>
    </div>
  );
}
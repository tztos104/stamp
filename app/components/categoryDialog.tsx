// app/components/CategoryDialog.tsx (최종 수정본)

import { useFetcher, useRevalidator } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "~/components/ui/dialog"; // 👈 DialogClose 추가
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";


type Category = {
    id: number;
    name: string;
}


export function CategoryDialog({ categories}: { categories: Category[]}) {
    const [newCategoryName, setNewCategoryName] = useState("");
    const addFetcher = useFetcher();
    const deleteFetcher = useFetcher();
    const revalidator = useRevalidator();
    const inputRef = useRef<HTMLInputElement>(null);

    const isAdding = addFetcher.state !== 'idle';

  
 
    const handleDelete = (categoryId: number) => {
        const formData = new FormData();
        formData.append("id", String(categoryId));
        deleteFetcher.submit(formData, { method: "delete", action: "/api/categories" });
    };
    
    const handleAdd = () => {
        if (!newCategoryName.trim()) {
            
            return ;
        }
        const formData = new FormData();
        formData.append("name", newCategoryName);
        addFetcher.submit(formData, { method: "post", action: "/api/categories" });
    }

    return (
        // 👇 내부 상태 대신 props로 제어
        <Dialog >
            <DialogTrigger asChild>
                <Button type="button" variant="outline">관리</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>카테고리 관리</DialogTitle>
                     <DialogDescription className="text-xs mt-2 text-muted-foreground">
            새로운 카테고리를 추가하거나 기존 카테고리를 삭제할 수 있습니다.
        </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4 max-h-60 overflow-y-auto">
                    {categories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between">
                            <span>{category.name}</span>
                            {/* 👇 button type="button"으로 외부 폼 제출 방지 */}
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="new-category-name">새 카테고리 이름</Label>
                    <div className="flex gap-2">
                        <Input 
                            id="new-category-name" 
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            ref={inputRef}
                        />
                        <Button type="button" onClick={handleAdd} disabled={isAdding}>
                            {isAdding ? "추가 중..." : "추가"}
                        </Button>
                    </div>
                     {addFetcher.data?.error && (
                        <p className="text-sm text-red-500">{addFetcher.data.error}</p>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">닫기</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
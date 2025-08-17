// app/add-product/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { siteSettingsAtom } from "@/lib/atoms/siteSettingsAtom";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";
import { useAtomValue } from "jotai";
import { Minus, Pin, Plus } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// DnD Kit
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type UIProduct = {
  docId: string;
  productId: number;
  name: string;
  price: number;
  taxIncluded: boolean;
  imageUri: string;
  description: string;
  soldOut: boolean;
  sortIndex: number;
  sectionId?: string | null;
};

type Section = {
  id: string; // sections の doc.id
  name: string;
  sortIndex: number;
};

const TAX_RATE = 0.1 as const;
const toInclusive = (p: number, inc: boolean) =>
  inc ? p : Math.round(p * (1 + TAX_RATE));
const toExclusive = (p: number, inc: boolean) =>
  inc ? Math.round(p / (1 + TAX_RATE)) : p;

export default function AddProductPage() {
  const siteSettings = useAtomValue(siteSettingsAtom);
  const siteKey = siteSettings?.siteKey ?? siteSettings?.id ?? "";
  const siteSettingsDocId = siteSettings?.id ?? null;

  // 追加フォーム（モーダル）
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | undefined>();
  const [formTaxIncluded, setFormTaxIncluded] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  // 一覧
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [displayMode, setDisplayMode] = useState<"inclusive" | "exclusive">(
    "inclusive"
  );
  const [loading, setLoading] = useState(false);

  // AIダイアログ
  const [aiOpen, setAiOpen] = useState(false);
  const [kw1, setKw1] = useState("");
  const [kw2, setKw2] = useState("");
  const [kw3, setKw3] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const canGenerate = useMemo(
    () => [kw1, kw2, kw3].some((k) => k.trim().length > 0),
    [kw1, kw2, kw3]
  );

  // 編集ダイアログ
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<UIProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number | undefined>();
  const [editTaxIncluded, setEditTaxIncluded] = useState(true);
  const [editDesc, setEditDesc] = useState("");
  const [editSoldOut, setEditSoldOut] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState("");

  // セクション関連
  const [sections, setSections] = useState<Section[]>([]);
  const [formSectionId, setFormSectionId] = useState<string>(""); // 追加フォーム用
  const [editSectionId, setEditSectionId] = useState<string>(""); // 編集用

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");

  // 一覧フィルタ
  const [filterSectionId, setFilterSectionId] = useState<string>("__ALL__");

  const shownProducts = useMemo(() => {
    return filterSectionId === "__ALL__"
      ? products
      : products.filter((p) => p.sectionId === filterSectionId);
  }, [products, filterSectionId]);

  // 共通：追加フォームのリセット
  const resetAddForm = () => {
    setName("");
    setDescription("");
    setPrice(undefined);
    setFormTaxIncluded(true);
    setFile(null);
    setPreview("");
    setFormSectionId("");
    if (fileInput.current) fileInput.current.value = "";
  };

  // セクション作成
  const createSection = async () => {
    if (!siteKey || !sectionName.trim()) return;
    const nextSort = sections.length
      ? Math.max(...sections.map((s) => s.sortIndex)) + 1000
      : 1000;
    await setDoc(doc(collection(db, "sections")), {
      siteKey,
      name: sectionName.trim(),
      sortIndex: nextSort,
      createdAt: serverTimestamp(),
    });
    setSectionName("");
    setSectionDialogOpen(false);
  };

  // セクション購読
  useEffect(() => {
    if (!siteKey) return;
    const qy = query(
      collection(db, "sections"),
      where("siteKey", "==", siteKey),
      orderBy("sortIndex", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Section[] = snap.docs.map((d, i) => {
        const v = d.data() as any;
        return {
          id: d.id,
          name: String(v.name ?? ""),
          sortIndex:
            typeof v.sortIndex === "number" ? v.sortIndex : (i + 1) * 1000,
        };
      });
      setSections(arr);
    });
    return () => unsub();
  }, [siteKey]);

  // 商品購読
  useEffect(() => {
    if (!siteKey) return;
    const qy = query(
      collection(db, "products"),
      where("siteKey", "==", siteKey),
      orderBy("sortIndex", "asc"),
      orderBy("productId", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const arr: UIProduct[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const fallback = Number(data.productId ?? 0) * 1000;
        return {
          docId: d.id,
          productId: Number(data.productId ?? 0),
          name: data.name,
          price: Number(data.price ?? 0),
          taxIncluded: Boolean(data.taxIncluded ?? true),
          imageUri: data.imageUri,
          description: data.description || "",
          soldOut: Boolean(data.soldOut ?? false),
          sortIndex:
            typeof data.sortIndex === "number" ? data.sortIndex : fallback,
          sectionId: typeof data.sectionId === "string" ? data.sectionId : null,
        };
      });
      setProducts(arr);
    });
    return () => unsub();
  }, [siteKey]);

  // 表示モード初期化
  useEffect(() => {
    const pref = (siteSettings as any)?.taxDisplayMode as
      | "inclusive"
      | "exclusive"
      | undefined;
    if (pref) setDisplayMode(pref);
  }, [siteSettings]);

  // 画像選択（追加）
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  // 画像選択（編集）
  const onEditFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditFile(f);
    setEditPreview(URL.createObjectURL(f));
  };

  // セクション削除
  const deleteSection = async (sec: Section) => {
    if (!siteKey) return;
    try {
      const prodQ = query(
        collection(db, "products"),
        where("siteKey", "==", siteKey),
        where("sectionId", "==", sec.id)
      );
      const prodSnap = await getDocs(prodQ);
      const count = prodSnap.size;

      const ok = confirm(
        `セクション「${sec.name}」を削除しますか？\n` +
          (count > 0
            ? `このセクションに紐づく ${count} 件の商品は「未設定」に移動します。`
            : `紐づく商品はありません。`)
      );
      if (!ok) return;

      let batch = writeBatch(db);
      let writes = 0;

      prodSnap.docs.forEach((d) => {
        batch.update(d.ref, { sectionId: null });
        writes++;
        if (writes >= 450) {
          batch.commit();
          batch = writeBatch(db);
          writes = 0;
        }
      });

      batch.delete(doc(db, "sections", sec.id));
      await batch.commit();

      if (filterSectionId === sec.id) setFilterSectionId("__ALL__");
      if (formSectionId === sec.id) setFormSectionId("");
      if (editSectionId === sec.id) setEditSectionId("");

      toast.success(`セクション「${sec.name}」を削除しました`);
    } catch (e) {
      console.error(e);
      toast.error("セクションの削除に失敗しました");
    }
  };

  // 商品追加
  const handleAdd = async () => {
    if (!siteKey) {
      toast.error("siteKey 未取得のため追加できません");
      return;
    }
    if (!name.trim() || price == null || !file) {
      toast.warning("必須項目を入力してください");
      return;
    }
    try {
      setLoading(true);

      const nextId =
        (products.length ? Math.max(...products.map((p) => p.productId)) : 0) +
        1;

      const nextSort = products.length
        ? Math.max(...products.map((p) => p.sortIndex)) + 1000
        : 1000;

      const ref = sRef(storage, `products/${siteKey}/${nextId}_${file.name}`);
      await uploadBytes(ref, file);
      const imageUrl = await getDownloadURL(ref);

      const docId = `${siteKey}_${nextId}`;
      await setDoc(doc(db, "products", docId), {
        siteKey,
        productId: nextId,
        name,
        price,
        taxIncluded: formTaxIncluded,
        imageUri: imageUrl,
        description: description.trim() || "",
        soldOut: false,
        sortIndex: nextSort,
        sectionId: formSectionId || null,
        createdAt: serverTimestamp(),
      });

      resetAddForm();
      setFormOpen(false);
      toast.success("商品を追加しました");
    } catch (e) {
      console.error(e);
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 編集フォームのリセット
  const resetEditForm = () => {
    setEditing(null);
    setEditName("");
    setEditPrice(undefined);
    setEditTaxIncluded(true);
    setEditDesc("");
    setEditSoldOut(false);
    setEditFile(null);
    setEditPreview("");
    setEditSectionId("");
  };

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open);
    if (!open) resetEditForm();
  };

  // 商品削除
  const handleDelete = async (docId: string) => {
    if (!confirm("この商品を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "products", docId));
      toast.success("削除しました");
    } catch (e) {
      console.error(e);
      toast.error("削除に失敗しました");
    }
  };

  // 編集開始
  const openEdit = (p: UIProduct) => {
    setEditing(p);
    setEditName(p.name);
    setEditPrice(p.price);
    setEditTaxIncluded(p.taxIncluded);
    setEditDesc(p.description);
    setEditSoldOut(p.soldOut);
    setEditFile(null);
    setEditPreview("");
    setEditOpen(true);
    setEditSectionId(p.sectionId ?? "");
  };

  // 編集保存
  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim() || editPrice == null) {
      toast.warning("名前と価格は必須です");
      return;
    }
    try {
      let imageUri = editing.imageUri;
      if (editFile) {
        const ref = sRef(
          storage,
          `products/${siteKey}/${editing.productId}_${editFile.name}`
        );
        await uploadBytes(ref, editFile);
        imageUri = await getDownloadURL(ref);
      }
      await updateDoc(doc(db, "products", editing.docId), {
        name: editName.trim(),
        price: editPrice,
        taxIncluded: editTaxIncluded,
        description: editDesc.trim(),
        soldOut: editSoldOut,
        imageUri,
        sectionId: editSectionId || null,
        updatedAt: serverTimestamp(),
      });
      setEditOpen(false);
      toast.success("更新しました");
    } catch (e) {
      console.error(e);
      toast.error("更新に失敗しました");
    }
  };

  // 表示モード切替（Firestoreにも保存）
  const changeDisplayMode = async (mode: "inclusive" | "exclusive") => {
    setDisplayMode(mode);
    if (!siteSettingsDocId) return;
    try {
      await updateDoc(doc(db, "siteSettings", siteSettingsDocId), {
        taxDisplayMode: mode,
      });
    } catch (e) {
      console.warn("display mode save failed:", e);
    }
  };

  // AIモーダル
  const openAi = () => {
    if (!name.trim()) {
      toast.warning("タイトル（商品名）を入力してください");
      return;
    }
    setAiOpen(true);
  };

  const generateDescription = async () => {
    const keywords = [kw1, kw2, kw3].map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) return;
    try {
      setAiLoading(true);
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name.trim(), keywords, siteKey }),
      });
      if (!res.ok) throw new Error("AI endpoint error");
      const data = await res.json();
      setDescription(String(data?.description ?? ""));
      setAiOpen(false);
      setKw1("");
      setKw2("");
      setKw3("");
      toast.success("AIが本文を生成しました");
    } catch (e) {
      console.error(e);
      toast.error("本文生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = products.findIndex((p) => p.docId === String(active.id));
    const newIndex = products.findIndex((p) => p.docId === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(products, oldIndex, newIndex);
    setProducts(reordered);

    try {
      const batch = writeBatch(db);
      reordered.forEach((p, idx) => {
        batch.update(doc(db, "products", p.docId), {
          sortIndex: (idx + 1) * 1000,
        });
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      toast.error("並び順の保存に失敗しました");
    }
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-screen-md mx-auto">
      {/* タイトル + プラスボタン */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold pt-12">クレープ商品管理</h1>
      </div>

      {/* 一覧ヘッダ（表示モード & セクション） */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium">登録済み一覧</h2>

        {/* 表示モード */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">表示:</span>
          <Button
            size="sm"
            variant={displayMode === "inclusive" ? "default" : "outline"}
            onClick={() => changeDisplayMode("inclusive")}
          >
            税込
          </Button>
          <Button
            size="sm"
            variant={displayMode === "exclusive" ? "default" : "outline"}
            onClick={() => changeDisplayMode("exclusive")}
          >
            税抜き
          </Button>
        </div>

        {/* フィルタ：セクション & 追加 */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}
            className="h-9 rounded-md border px-2 text-sm"
          >
            <option value="__ALL__">全セクション</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* セクション追加（DialogTrigger 構成） */}
          <Dialog
            open={sectionDialogOpen}
            onOpenChange={(open) => {
              setSectionDialogOpen(open);
              if (!open) setSectionName("");
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onPointerDown={(e) => e.stopPropagation()}
              >
                + セクション追加
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>セクションを追加</DialogTitle>
              </DialogHeader>

              {/* 追加フォーム */}
              <div className="space-y-2">
                <Label>セクション名</Label>
                <Input
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="例）定番・季節限定・ドリンク など"
                />
              </div>

              <DialogFooter className="mt-2">
                <Button
                  variant="outline"
                  onClick={() => setSectionDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={createSection} disabled={!sectionName.trim()}>
                  作成
                </Button>
              </DialogFooter>

              {/* 既存一覧＋削除 */}
              <div className="mt-6">
                <p className="text-sm text-gray-600">既存セクション</p>
                <ul className="mt-2 divide-y rounded-md border">
                  {sections.length === 0 && (
                    <li className="p-3 text-sm text-gray-500">
                      まだありません
                    </li>
                  )}
                  {sections.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between p-3"
                    >
                      <span className="text-sm">{s.name}</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteSection(s)}
                      >
                        削除
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2列固定 + ドラッグ&ドロップ */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={shownProducts.map((p) => p.docId)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-5">
            {shownProducts.map((p) => {
              const shown =
                displayMode === "inclusive"
                  ? toInclusive(p.price, p.taxIncluded)
                  : toExclusive(p.price, p.taxIncluded);
              return (
                <SortableCard key={p.docId} id={p.docId}>
                  <div className="rounded-md border bg-white p-2 text-left shadow-sm relative">
                    <div className="relative aspect-square overflow-hidden rounded-md">
                      <Image
                        src={p.imageUri}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="50vw"
                      />
                      {p.soldOut && (
                        <div className="absolute inset-0 z-10 grid place-items-center bg-black/40">
                          <Image
                            src="/images/soldOut.png" // public/images/soldOut.png に置いたファイル
                            alt="SOLD OUT"
                            fill
                            className="object-contain pointer-events-none select-none"
                            priority={false}
                          />
                        </div>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-1 text-sm">
                      {p.productId}. {p.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      ￥{shown.toLocaleString()}{" "}
                      {displayMode === "inclusive" ? "(税込)" : "(税抜き)"}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(p)}
                      >
                        編集
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDelete(p.docId)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </SortableCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* 画面右下の固定FAB（追加フォームを開く） */}
      <Button
        size="icon"
        onClick={() => setFormOpen(true)}
        aria-label={formOpen ? "フォームを閉じる" : "フォームを開く"}
        title={formOpen ? "閉じる" : "追加フォームを開く"}
        className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[70] h-14 w-14 rounded-full shadow-lg"
      >
        {formOpen ? (
          <Minus className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>

      {/* AIダイアログ */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AIで本文生成</DialogTitle>
          </DialogHeader>
          <p className="mb-2 text-sm text-gray-600">
            「{name || "（タイトル未入力）"}
            」をもとに、キーワードを1〜3個入力してください。
          </p>
          <div className="space-y-3">
            <Input
              placeholder="キーワード1（必須）"
              value={kw1}
              onChange={(e) => setKw1(e.target.value)}
            />
            <Input
              placeholder="キーワード2（任意）"
              value={kw2}
              onChange={(e) => setKw2(e.target.value)}
            />
            <Input
              placeholder="キーワード3（任意）"
              value={kw3}
              onChange={(e) => setKw3(e.target.value)}
            />
            {!canGenerate && (
              <p className="text-xs text-red-500">
                キーワードを1つ以上入力すると「生成する」が有効になります。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={generateDescription}
              disabled={!canGenerate || aiLoading}
            >
              {aiLoading ? "生成中…" : "生成する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 追加フォーム（モーダル） */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetAddForm(); // 閉じる時に未設定へ戻す
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>商品を追加</DialogTitle>
          </DialogHeader>

          {!siteKey && (
            <p className="text-sm font-semibold text-red-600">
              siteKey が見つかりません。ログインし直してください。
            </p>
          )}

          <div className="space-y-4">
            {/* セクション選択（任意） */}
            <div className="grid gap-2">
              <Label>セクション（任意）</Label>
              <select
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                className="h-10 rounded-md border px-2"
              >
                <option value="">未設定</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                未設定の場合は「セクションなし」で保存されます。
              </p>
            </div>

            {/* タイトル */}
            <div className="grid gap-2">
              <Label htmlFor="name">タイトル（商品名）</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例）ストロベリーチョコ"
              />
            </div>

            {/* 価格＋税込/税抜 */}
            <div className="grid gap-2">
              <Label htmlFor="price">価格</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="price"
                  type="number"
                  inputMode="numeric"
                  value={price ?? ""}
                  onChange={(e) =>
                    setPrice(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  className="w-full"
                  min={0}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={formTaxIncluded ? "default" : "outline"}
                    onClick={() => setFormTaxIncluded(true)}
                  >
                    税込
                  </Button>
                  <Button
                    size="sm"
                    variant={!formTaxIncluded ? "default" : "outline"}
                    onClick={() => setFormTaxIncluded(false)}
                  >
                    税抜き
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                選択した設定は保存価格が「税込/税抜」どちらかを表します。
              </p>
            </div>

            {/* 説明文＋AI生成 */}
            <div className="grid gap-2">
              <Label htmlFor="desc">説明文</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
              <Button type="button" className="mt-2" onClick={openAi}>
                AIで本文生成
              </Button>
            </div>

            {/* 画像 */}
            <div className="grid gap-2">
              <Label htmlFor="img">画像アップロード</Label>
              <Input
                id="img"
                type="file"
                accept="image/*"
                onChange={onFile}
                ref={fileInput}
              />
              {preview && (
                <div className="mt-2 w-40 aspect-square relative overflow-hidden rounded-md">
                  <Image
                    src={preview}
                    alt="preview"
                    fill
                    className="object-cover"
                    unoptimized
                    priority
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={loading || !siteKey}>
              {loading ? "追加中…" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集フォーム（モーダル） */}
      <Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>商品を編集</DialogTitle>
          </DialogHeader>

          {!editing ? (
            <p className="text-sm text-gray-500">読み込み中…</p>
          ) : (
            <div className="space-y-4">
              {/* セクション */}
              <div className="grid gap-2">
                <Label>セクション</Label>
                <select
                  value={editSectionId}
                  onChange={(e) => setEditSectionId(e.target.value)}
                  className="h-10 rounded-md border px-2"
                >
                  <option value="">未設定</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 商品名 */}
              <div className="grid gap-2">
                <Label>商品名</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              {/* 価格＋税込/税抜 */}
              <div className="grid gap-2">
                <Label>価格</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={editPrice ?? ""}
                    onChange={(e) =>
                      setEditPrice(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    min={0}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={editTaxIncluded ? "default" : "outline"}
                      onClick={() => setEditTaxIncluded(true)}
                    >
                      税込
                    </Button>
                    <Button
                      size="sm"
                      variant={!editTaxIncluded ? "default" : "outline"}
                      onClick={() => setEditTaxIncluded(false)}
                    >
                      税抜き
                    </Button>
                  </div>
                </div>
              </div>

              {/* 説明文 */}
              <div className="grid gap-2">
                <Label>説明文</Label>
                <Textarea
                  rows={6}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {/* 販売ステータス */}
              <div className="grid gap-2">
                <Label>販売ステータス</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={editSoldOut ? "outline" : "default"}
                    onClick={() => setEditSoldOut(false)}
                  >
                    販売中
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!editSoldOut ? "outline" : "default"}
                    onClick={() => setEditSoldOut(true)}
                  >
                    売り切れ
                  </Button>
                </div>
              </div>

              {/* 画像（変更時のみ） */}
              <div className="grid gap-2">
                <Label>画像（変更する場合のみ選択）</Label>
                <Input type="file" accept="image/*" onChange={onEditFile} />
                {(editPreview || editing.imageUri) && (
                  <div className="mt-2 w-40 aspect-square relative overflow-hidden rounded-md">
                    <Image
                      src={editPreview || editing.imageUri}
                      alt="preview"
                      fill
                      className="object-cover"
                      unoptimized={Boolean(editPreview)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleEditOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button onClick={saveEdit} disabled={!editing}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* --- Sortable 子コンポーネント（トップ中央にドラッグハンドル） --- */
function SortableCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* ドラッグ用ハンドル（トップセンター） */}
      <button
        {...listeners}
        {...attributes}
        type="button"
        aria-label="並べ替え"
        onContextMenu={(e) => e.preventDefault()}
        className="
          drag-handle
          pointer-events-auto
          absolute left-1/2 -translate-x-1/2 -top-4
          z-10 flex h-8 w-8 items-center justify-center
          rounded-full border bg-white shadow-sm
          hover:bg-gray-50
          cursor-grab active:cursor-grabbing
          touch-none select-none
        "
        style={{
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <Pin className="h-4 w-4 -rotate-12" />
      </button>
      {children}
    </div>
  );
}

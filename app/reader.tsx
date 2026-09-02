'use client';

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ExternalLink,
  LibraryBig,
  Menu,
  Minus,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type Note = {
  line?: number;
  label?: string;
  text: string;
};

type GreekLine = {
  line: number;
  text: string;
};

type Paragraph = {
  id: string;
  book: number;
  paragraph: number;
  lineStart: number;
  lineEnd: number;
  lineRefs: number[];
  greekLines: GreekLine[];
  greek: string;
  korean: string;
  notes: Note[];
  translationStatus: string;
};

type BookData = {
  book: number;
  labelGreek: string;
  labelKorean: string;
  lineCount: number;
  paragraphCount: number;
  translationCount: number;
  lineNumberGaps: number[];
  paragraphs: Paragraph[];
};

type Manifest = {
  workTitleGreek: string;
  workTitleKorean: string;
  stats: {
    books: number;
    lines: number;
    paragraphs: number;
    translatedParagraphs: number;
  };
  books: Array<{
    book: number;
    path: string;
    lineCount: number;
    paragraphCount: number;
    translationCount: number;
  }>;
  reference: {
    path: string;
    counts: Record<ReferenceKey, number>;
  };
};

type ViewMode = 'parallel' | 'greek' | 'korean';
type ReferenceKey = 'glossary' | 'people' | 'places' | 'textualNotes';

type PassageReference = {
  book: number;
  line: number;
  label?: string;
};

type ReferenceSource = {
  label: string;
  url: string;
};

type ReferenceEntry = {
  id: string;
  nameGreek?: string;
  nameKo?: string;
  transliteration?: string;
  role?: string;
  kind?: string;
  title?: string;
  scope?: string;
  status?: string;
  summary: string;
  details?: string;
  refs: PassageReference[];
  sources?: ReferenceSource[];
};

type ReferenceData = {
  schemaVersion: number;
  source: {
    edition: string;
    urn: string;
    sourceCommit: string;
    sourceSha256: string;
    license: string;
    licenseUrl: string;
  };
  sections: Record<
    ReferenceKey,
    {
      title: string;
      description: string;
      entries: ReferenceEntry[];
    }
  >;
};

const REFERENCE_TABS: Array<{ key: ReferenceKey; label: string }> = [
  { key: 'glossary', label: '용어' },
  { key: 'people', label: '인물' },
  { key: 'places', label: '장소' },
  { key: 'textualNotes', label: '본문' },
];

const GREEK_BOOK_LABELS = [
  'α',
  'β',
  'γ',
  'δ',
  'ε',
  'ζ',
  'η',
  'θ',
  'ι',
  'κ',
  'λ',
  'μ',
  'ν',
  'ξ',
  'ο',
  'π',
  'ρ',
  'σ',
  'τ',
  'υ',
  'φ',
  'χ',
  'ψ',
  'ω',
];

function rangeLabel(paragraph: Paragraph) {
  return paragraph.lineStart === paragraph.lineEnd
    ? `${paragraph.book}.${paragraph.lineStart}`
    : `${paragraph.book}.${paragraph.lineStart}–${paragraph.lineEnd}`;
}

function dataUrl(basePath: string, book: number) {
  return `${basePath}/data/books/${String(book).padStart(2, '0')}.json`;
}

export function OdysseyReader({
  initialBook,
  manifest,
  basePath,
}: {
  initialBook: BookData;
  manifest: Manifest;
  basePath: string;
}) {
  const [book, setBook] = useState<BookData>(initialBook);
  const [requestedBook, setRequestedBook] = useState(initialBook.book);
  const [viewMode, setViewMode] = useState<ViewMode>('parallel');
  const [readerScale, setReaderScale] = useState(1);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeParagraph, setActiveParagraph] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(
    null,
  );
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const [referenceTab, setReferenceTab] =
    useState<ReferenceKey>('glossary');
  const [referenceQuery, setReferenceQuery] = useState('');
  const cache = useRef(
    new Map<number, BookData>([[initialBook.book, initialBook]]),
  );

  const translated = book.translationCount > 0;
  const progress = Math.max(
    0,
    Math.min(100, (activeParagraph / Math.max(1, book.paragraphCount)) * 100),
  );

  const loadBook = useCallback(
    async (nextBook: number, line?: number) => {
      if (nextBook < 1 || nextBook > 24) return;
      setRequestedBook(nextBook);
      setLoading(true);
      try {
        let next = cache.current.get(nextBook);
        if (!next) {
          const response = await fetch(dataUrl(basePath, nextBook));
          if (!response.ok) {
            throw new Error(`Book ${nextBook} failed to load`);
          }
          next = (await response.json()) as BookData;
          cache.current.set(nextBook, next);
        }
        setBook(next);
        const targetLine = line ?? 1;
        const url = new URL(window.location.href);
        url.searchParams.set('book', String(nextBook));
        url.searchParams.set('line', String(targetLine));
        window.history.replaceState({}, '', url);
        window.localStorage.setItem(
          'odyssey-reading-position',
          JSON.stringify({ book: nextBook, line: targetLine }),
        );
        window.setTimeout(() => {
          const exactTarget = document.querySelector(
            `[data-book="${nextBook}"][data-line-start="${targetLine}"]`,
          );
          const containingTarget = Array.from(
            document.querySelectorAll<HTMLElement>(
              `[data-book="${nextBook}"][data-passage]`,
            ),
          ).find((node) => {
            const start = Number(node.dataset.lineStart || 0);
            const paragraph = next?.paragraphs.find(
              (row) => row.lineStart === start,
            );
            return paragraph
              ? targetLine >= paragraph.lineStart &&
                  targetLine <= paragraph.lineEnd
              : false;
          });
          const target = exactTarget || containingTarget;
          if (target instanceof HTMLElement) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        }, 40);
      } finally {
        setLoading(false);
        setMenuOpen(false);
      }
    },
    [basePath],
  );

  const loadReference = useCallback(async () => {
    if (referenceData || referenceLoading) return;
    setReferenceLoading(true);
    setReferenceError('');
    try {
      const response = await fetch(
        `${basePath}/${manifest.reference.path}`.replace(/([^:]\/)\/+/, '$1'),
      );
      if (!response.ok) throw new Error('Reference data failed to load');
      setReferenceData((await response.json()) as ReferenceData);
    } catch {
      setReferenceError('읽기 자료를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setReferenceLoading(false);
    }
  }, [basePath, manifest.reference.path, referenceData, referenceLoading]);

  const changeReferenceOpen = (open: boolean) => {
    setReferenceOpen(open);
    if (open) void loadReference();
  };

  useEffect(() => {
    const savedMode = window.localStorage.getItem(
      'odyssey-view-mode',
    ) as ViewMode | null;
    const savedScale = Number(
      window.localStorage.getItem('odyssey-reader-scale'),
    );
    const savedTheme = window.localStorage.getItem('odyssey-theme');
    if (savedMode && ['parallel', 'greek', 'korean'].includes(savedMode)) {
      setViewMode(savedMode);
    }
    if (savedScale >= 0.9 && savedScale <= 1.2) setReaderScale(savedScale);
    const shouldUseDark = savedTheme
      ? savedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(shouldUseDark);

    const url = new URL(window.location.href);
    const queryBook = Number(url.searchParams.get('book'));
    const queryLine = Number(url.searchParams.get('line'));
    if (queryBook >= 1 && queryBook <= 24) {
      void loadBook(queryBook, queryLine > 0 ? queryLine : 1);
      return;
    }
    const stored = window.localStorage.getItem('odyssey-reading-position');
    if (stored) {
      try {
        const position = JSON.parse(stored) as {
          book?: number;
          line?: number;
        };
        if (position.book && position.book >= 1 && position.book <= 24) {
          void loadBook(position.book, position.line || 1);
        }
      } catch {
        // Ignore a malformed local preference and start at the beginning.
      }
    }
  }, [loadBook]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    window.localStorage.setItem('odyssey-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-passage]'),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (!visible) return;
        const node = visible.target as HTMLElement;
        const paragraph = Number(node.dataset.paragraph || 1);
        const line = Number(node.dataset.lineStart || 1);
        setActiveParagraph(paragraph);
        window.localStorage.setItem(
          'odyssey-reading-position',
          JSON.stringify({ book: book.book, line }),
        );
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [book]);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem('odyssey-view-mode', mode);
  };

  const changeScale = (delta: number) => {
    const next = Math.max(
      0.9,
      Math.min(1.2, Number((readerScale + delta).toFixed(2))),
    );
    setReaderScale(next);
    window.localStorage.setItem('odyssey-reader-scale', String(next));
  };

  const copyParagraph = async (paragraph: Paragraph) => {
    const parts = [
      `『오디세이아』 제${paragraph.book}권 ${paragraph.lineStart}–${paragraph.lineEnd}행`,
      '',
      paragraph.greek,
    ];
    if (paragraph.korean) parts.push('', paragraph.korean);
    parts.push(
      '',
      `https://superantichrist.github.io/odyssey-reader/?book=${paragraph.book}&line=${paragraph.lineStart}`,
    );
    await navigator.clipboard.writeText(parts.join('\n'));
    setCopiedId(paragraph.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  };

  const bookItems = useMemo(
    () =>
      manifest.books.map((item) => ({
        ...item,
        greek: GREEK_BOOK_LABELS[item.book - 1],
      })),
    [manifest.books],
  );

  const activeReferenceSection = referenceData?.sections[referenceTab];
  const referenceEntries = useMemo(() => {
    const entries = referenceData?.sections[referenceTab].entries ?? [];
    const query = referenceQuery.trim().toLocaleLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.nameGreek,
        entry.nameKo,
        entry.transliteration,
        entry.role,
        entry.kind,
        entry.title,
        entry.scope,
        entry.status,
        entry.summary,
        entry.details,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [referenceData, referenceQuery, referenceTab]);

  const goToReference = (reference: PassageReference) => {
    setReferenceOpen(false);
    void loadBook(reference.book, reference.line);
  };

  const toc = (
    <nav aria-label="24권 목차" className="toc-list">
      {bookItems.map((item) => (
        <button
          type="button"
          key={item.book}
          className="toc-item"
          data-active={item.book === requestedBook}
          onClick={() => void loadBook(item.book)}
        >
          <span className="toc-greek">{item.greek}</span>
          <span className="toc-name">제{item.book}권</span>
          <span className="toc-count">{item.lineCount}행</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div
      className="reader-shell"
      style={{ '--reader-scale': readerScale } as CSSProperties}
    >
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <header className="reader-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ο
            </span>
            <div>
              <a href={basePath || '/'} className="brand-title">
                ὈΔΎΣΣΕΙΑ
              </a>
              <p className="brand-subtitle">원문과 직역</p>
            </div>
          </div>

          <div className="header-controls">
            <Select
              value={String(requestedBook)}
              onValueChange={(value) => void loadBook(Number(value))}
            >
              <SelectTrigger aria-label="권 선택" className="book-select">
                <SelectValue>{`제${requestedBook}권`}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {bookItems.map((item) => (
                  <SelectItem key={item.book} value={String(item.book)}>
                    {item.greek} · 제{item.book}권
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mode-switch" aria-label="원문과 번역 표시 방식">
              {(['parallel', 'greek', 'korean'] as ViewMode[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  data-active={viewMode === mode}
                  onClick={() => changeViewMode(mode)}
                >
                  {mode === 'parallel'
                    ? '나란히'
                    : mode === 'greek'
                      ? '원문'
                      : '직역'}
                </button>
              ))}
            </div>

            <Sheet open={referenceOpen} onOpenChange={changeReferenceOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="reference-trigger"
                    aria-label="용어·인물·장소·본문비평 자료 열기"
                  />
                }
              >
                <LibraryBig />
                <span>읽기 자료</span>
              </SheetTrigger>
              <SheetContent side="right" className="reference-sheet">
                <SheetHeader className="reference-header">
                  <SheetTitle>읽기 자료</SheetTitle>
                  <SheetDescription>
                    용어·인물·장소와 판본 쟁점을 현재 읽는 본문에 연결합니다.
                  </SheetDescription>
                </SheetHeader>

                <div className="reference-tools">
                  <div className="reference-tabs" aria-label="읽기 자료 종류">
                    {REFERENCE_TABS.map((tab) => (
                      <button
                        type="button"
                        key={tab.key}
                        data-active={referenceTab === tab.key}
                        onClick={() => setReferenceTab(tab.key)}
                      >
                        {tab.label}
                        <span>{manifest.reference.counts[tab.key]}</span>
                      </button>
                    ))}
                  </div>
                  <label className="reference-search">
                    <Search aria-hidden="true" />
                    <span className="sr-only">읽기 자료 검색</span>
                    <input
                      type="search"
                      value={referenceQuery}
                      onChange={(event) => setReferenceQuery(event.target.value)}
                      placeholder="이름이나 설명 검색"
                    />
                  </label>
                </div>

                <div className="reference-body">
                  {referenceLoading && (
                    <p className="reference-state">읽기 자료를 불러오는 중…</p>
                  )}
                  {referenceError && (
                    <div className="reference-state">
                      <p>{referenceError}</p>
                      <Button size="sm" variant="outline" onClick={() => void loadReference()}>
                        다시 시도
                      </Button>
                    </div>
                  )}
                  {activeReferenceSection && (
                    <>
                      <div className="reference-intro">
                        <p>{activeReferenceSection.description}</p>
                      </div>

                      {referenceTab === 'textualNotes' && referenceData && (
                        <section className="edition-card" aria-label="데이터 판본">
                          <span>데이터 판본</span>
                          <strong>{referenceData.source.edition}</strong>
                          <code>{referenceData.source.urn}</code>
                          <dl>
                            <div>
                              <dt>commit</dt>
                              <dd>{referenceData.source.sourceCommit.slice(0, 12)}</dd>
                            </div>
                            <div>
                              <dt>SHA-256</dt>
                              <dd>{referenceData.source.sourceSha256.slice(0, 16)}…</dd>
                            </div>
                          </dl>
                          <a
                            href={referenceData.source.licenseUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {referenceData.source.license} <ExternalLink />
                          </a>
                        </section>
                      )}

                      <div className="reference-list">
                        {referenceEntries.map((entry) => (
                          <article className="reference-card" key={entry.id}>
                            {entry.nameGreek && (
                              <p className="reference-greek" lang="grc">
                                {entry.nameGreek}
                              </p>
                            )}
                            <h3>{entry.title ?? entry.nameKo}</h3>
                            <p className="reference-meta">
                              {[
                                entry.transliteration,
                                entry.role,
                                entry.kind,
                                entry.scope,
                                entry.status,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className="reference-summary">{entry.summary}</p>
                            {entry.details && (
                              <p className="reference-details">{entry.details}</p>
                            )}
                            {entry.refs.length > 0 && (
                              <div className="reference-links" aria-label="관련 구절">
                                {entry.refs.map((reference) => (
                                  <button
                                    type="button"
                                    key={`${entry.id}-${reference.book}-${reference.line}`}
                                    onClick={() => goToReference(reference)}
                                  >
                                    <span>
                                      {reference.book}.{reference.line}
                                    </span>
                                    {reference.label ?? '본문에서 보기'}
                                  </button>
                                ))}
                              </div>
                            )}
                            {entry.sources && entry.sources.length > 0 && (
                              <div className="reference-sources" aria-label="참고 출처">
                                {entry.sources.map((source) => (
                                  <a
                                    href={source.url}
                                    key={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {source.label} <ExternalLink />
                                  </a>
                                ))}
                              </div>
                            )}
                          </article>
                        ))}
                        {referenceEntries.length === 0 && (
                          <p className="reference-state">검색 결과가 없습니다.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <div className="font-controls">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeScale(-0.05)}
                aria-label="글자 작게"
              >
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => changeScale(0.05)}
                aria-label="글자 크게"
              >
                <Plus />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? '밝은 화면' : '어두운 화면'}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="mobile-menu"
                    aria-label="목차 열기"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="toc-sheet">
                <SheetHeader>
                  <SheetTitle>스물네 권</SheetTitle>
                  <SheetDescription>읽을 권을 선택하세요.</SheetDescription>
                </SheetHeader>
                {toc}
                <Button
                  variant="outline"
                  className="toc-reference-button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.setTimeout(() => changeReferenceOpen(true), 120);
                  }}
                >
                  <LibraryBig /> 용어·인물·장소·본문비평
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="reader-layout">
        <aside className="desktop-toc">
          <div className="toc-heading">
            <BookOpen />
            <span>스물네 권</span>
          </div>
          {toc}
          <button
            type="button"
            className="aside-reference-button"
            onClick={() => changeReferenceOpen(true)}
          >
            <LibraryBig />
            <span>
              읽기 자료
              <small>용어 · 인물 · 장소 · 본문</small>
            </span>
          </button>
          <p className="source-note">
            A. T. Murray 편집
            <br />
            Perseus Digital Library · 1919
          </p>
        </aside>

        <main className="reading-column" aria-busy={loading}>
          <header className="book-heading">
            <p className="book-kicker">
              {GREEK_BOOK_LABELS[book.book - 1]} · {book.lineCount}행
            </p>
            <h1>제{book.book}권</h1>
            <p>
              {translated
                ? `${book.translationCount}개 문단의 그리스어 원문과 직접 옮긴 한국어 직역`
                : '그리스어 원문 전체 · 한국어 직역은 순차적으로 공개됩니다.'}
            </p>
          </header>

          <div className="passage-list" data-view={viewMode}>
            {book.paragraphs.map((paragraph) => (
              <section
                className="passage"
                id={`book-${book.book}-line-${paragraph.lineStart}`}
                key={paragraph.id}
                data-passage
                data-book={book.book}
                data-paragraph={paragraph.paragraph}
                data-line-start={paragraph.lineStart}
              >
                <div className="passage-meta">
                  <a
                    href={`?book=${book.book}&line=${paragraph.lineStart}`}
                    aria-label={`${rangeLabel(paragraph)} 영구 링크`}
                  >
                    {rangeLabel(paragraph)}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void copyParagraph(paragraph)}
                    aria-label={`${rangeLabel(paragraph)} 원문과 직역 복사`}
                  >
                    {copiedId === paragraph.id ? <Check /> : <Clipboard />}
                  </Button>
                </div>

                <div className="passage-columns">
                  <div className="greek-column" lang="grc">
                    {paragraph.greekLines.map((line, index) => (
                      <div className="verse-line" key={line.line}>
                        <span className="line-number" aria-hidden="true">
                          {index === 0 || line.line % 5 === 0 ? line.line : ''}
                        </span>
                        <span>{line.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="korean-column" lang="ko">
                    {paragraph.korean ? (
                      <p>{paragraph.korean}</p>
                    ) : (
                      <p className="translation-pending">직역 준비 중</p>
                    )}
                    {paragraph.notes.length > 0 && (
                      <ol className="notes-list" aria-label="번역 각주">
                        {paragraph.notes.map((note, index) => (
                          <li key={`${paragraph.id}-note-${index}`}>
                            <span>
                              {note.line
                                ? `${paragraph.book}.${note.line}`
                                : note.label || index + 1}
                            </span>
                            {note.text}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <nav className="book-navigation" aria-label="권 이동">
            <Button
              variant="outline"
              size="lg"
              disabled={book.book === 1}
              onClick={() => void loadBook(book.book - 1)}
            >
              <ChevronLeft /> 이전 권
            </Button>
            <p>{book.book} / 24</p>
            <Button
              variant="outline"
              size="lg"
              disabled={book.book === 24}
              onClick={() => void loadBook(book.book + 1)}
            >
              다음 권 <ChevronRight />
            </Button>
          </nav>
        </main>
      </div>
    </div>
  );
}

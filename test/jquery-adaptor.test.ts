import { afterEach, describe, expect, it, vi } from "vitest";

// biome-ignore lint/suspicious/noExplicitAny: jQuery 自体の型を持ち込まないための最小限の any
type FakeJQuery = { fn: Record<string, any> };
type DefineFn = ((
  deps: string[],
  factory: (jQuery: FakeJQuery) => void,
) => void) & {
  amd?: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var define: DefineFn | undefined;
}

describe("jQuery adaptor", () => {
  const originalDefine = global.define;
  const originalJQuery = (window as unknown as { jQuery?: FakeJQuery }).jQuery;
  const originalDollar = (window as unknown as { $?: FakeJQuery }).$;

  afterEach(() => {
    vi.resetModules();
    if (originalDefine === undefined) {
      delete (global as { define?: DefineFn }).define;
    } else {
      global.define = originalDefine;
    }
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = originalJQuery;
    (window as unknown as { $?: FakeJQuery }).$ = originalDollar;
    document.body.innerHTML = "";
    document.querySelectorAll("dialog.smartphoto").forEach((dialog) => {
      dialog.remove();
    });
  });

  it('AMD 環境では define(["jquery"], applyJQuery) を呼ぶ', async () => {
    let capturedDeps: string[] | undefined;
    let capturedFactory: ((jQuery: FakeJQuery) => void) | undefined;
    const fakeDefine = ((
      deps: string[],
      factory: (jQuery: FakeJQuery) => void,
    ) => {
      capturedDeps = deps;
      capturedFactory = factory;
    }) as DefineFn;
    fakeDefine.amd = true;
    global.define = fakeDefine;

    await import("../src/adaptor/jquery");

    expect(capturedDeps).toEqual(["jquery"]);
    expect(typeof capturedFactory).toBe("function");
  });

  it("非AMD環境で window.jQuery が存在する場合はそれにプラグインを登録する", async () => {
    delete (global as { define?: DefineFn }).define;
    const fakeJQuery: FakeJQuery = { fn: {} };
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = fakeJQuery;
    (window as unknown as { $?: FakeJQuery }).$ = undefined;

    await import("../src/adaptor/jquery");

    expect(typeof fakeJQuery.fn.SmartPhoto).toBe("function");
  });

  it("window.jQuery が無く window.$ がある場合はそちらに登録する", async () => {
    delete (global as { define?: DefineFn }).define;
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = undefined;
    const fakeDollar: FakeJQuery = { fn: {} };
    (window as unknown as { $?: FakeJQuery }).$ = fakeDollar;

    await import("../src/adaptor/jquery");

    expect(typeof fakeDollar.fn.SmartPhoto).toBe("function");
  });

  it("jQuery も $ も無い場合はプラグイン登録をスキップするが、モジュール自体は関数を export する", async () => {
    delete (global as { define?: DefineFn }).define;
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = undefined;
    (window as unknown as { $?: FakeJQuery }).$ = undefined;

    const mod = await import("../src/adaptor/jquery");

    expect(typeof mod.default).toBe("function");
  });

  it("SmartPhoto プラグイン関数は settings が文字列のとき何もせず this を返す", async () => {
    delete (global as { define?: DefineFn }).define;
    const fakeJQuery: FakeJQuery = { fn: {} };
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = fakeJQuery;
    (window as unknown as { $?: FakeJQuery }).$ = undefined;

    await import("../src/adaptor/jquery");

    const context: HTMLElement[] = [];
    const result = fakeJQuery.fn.SmartPhoto.call(context, "someMethodName");
    expect(result).toBe(context);
  });

  it("SmartPhoto プラグイン関数は settings がオブジェクトのとき SmartPhoto インスタンスを生成し this を返す", async () => {
    delete (global as { define?: DefineFn }).define;
    const fakeJQuery: FakeJQuery = { fn: {} };
    (window as unknown as { jQuery?: FakeJQuery }).jQuery = fakeJQuery;
    (window as unknown as { $?: FakeJQuery }).$ = undefined;

    await import("../src/adaptor/jquery");

    document.body.innerHTML =
      '<a href="./a.jpg" class="js-smartphoto"><img src="./a.jpg" alt="a" /></a>';
    const context = [document.querySelector(".js-smartphoto") as HTMLElement];
    const result = fakeJQuery.fn.SmartPhoto.call(context, {});

    expect(result).toBe(context);
    // dialog 要素が生成されている = SmartPhoto インスタンスが実際に構築された証拠
    expect(document.querySelector("dialog.smartphoto")).not.toBeNull();
  });
});

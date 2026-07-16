(() => {
  "use strict";
  const notice = document.getElementById("racecardNotice");
  document.querySelectorAll("[data-demo-action]").forEach((button) => {
    button.addEventListener("click", () => {
      notice.textContent = `${button.textContent.trim()}は現在準備中です。`;
    });
  });
  const form = document.getElementById("commentForm");
  const input = document.getElementById("commentInput");
  const list = document.getElementById("commentList");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const item = document.createElement("article");
    item.className = "comment";
    item.innerHTML = '<div class="comment-head"><span>ゲスト</span><span>たった今</span></div>';
    const text = document.createElement("p");
    text.textContent = value;
    item.appendChild(text);
    list.appendChild(item);
    input.value = "";
    notice.textContent = "コメントを画面上へ追加しました（デモ表示）。";
  });
})();

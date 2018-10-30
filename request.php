<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="utf-8" />
	<title>リクエスト</title>
</head>
<body>
<?php
	date_default_timezone_set('Asia/Tokyo');
	switch($_SERVER["REQUEST_METHOD"])
	{
		case "GET":
			$fp = fopen("./requested.csv", "r");
			flock($fp, LOCK_SH);
			echo "<h1>リクエスト一覧</h1>";
			echo "
			<table border=\"1\">
			<tbody>
				<tr>
					<td>日時</td>
					<td>タイトル</td>
					<td>動画URL</td>
					<td>備考</td>
				</tr>
			";
			while(($line = fgetcsv($fp)) != false)
			{
				echo "
				<tr>
					<td>$line[0]</td>
					<td>$line[1]</td>
					<td>$line[2]</td>
					<td>$line[3]</td>
				</tr>";
			}
			echo "
			</tbody>
			</table>
			";
			flock($fp, LOCK_UN);
			fclose($fp);
			break;
		case "POST":
			$fp = fopen("./requested.csv", "a");
			flock($fp, LOCK_EX);
			$title = $_POST["title"];
			$url = $_POST["url"];
			$note = $_POST["note"];
			fputcsv($fp, array(date("c"), $title, $url, $note));
			flock($fp, LOCK_UN);
			fclose($fp); 

			$h = htmlspecialchars;

			echo "
				<p>以下の内容でリクエストを受け付けました。</p>
				<table border=\"1\">
				<tbody>
					<tr>
						<td>タイトル</td>
						<td>{$h($title)}</td>
					</tr>
					<tr>
						<td>動画URL</td>
						<td>{$h($url)}</td>
					</tr>
					<tr>
						<td>備考</td>
						<td>{$h($note)}</td>
					</tr>
				</tbody>
				</table>
				<a href=\"index.html\">トップページへ</a>
			";
			break;
	}
?>
</body>
</html>

"""Literature - Poetry Toolkit (Cambridge IGCSE Literature in English 0475, Paper 1 poetry)."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from notes import render  # noqa: E402

TITLE = "Literature 0475 - Poetry Toolkit"

STYLE = """<style>
.tech { break-inside: auto; }
.tech tr { break-inside: avoid; }
.tech td:nth-child(1) { width: 17%; font-weight: 700; }
.tech td:nth-child(2) { width: 28%; }
.tech td:nth-child(3) { width: 22%; font-style: italic; color: #333; }
.para { border: 1.5px solid #bbb; border-radius: 6px; padding: 7px 10px; margin: 6px 0;
        line-height: 1.55; break-inside: avoid; }
.lab { font-family: 'Hand'; font-size: 9pt; color: #fff; padding: 0 5px; border-radius: 4px;
       margin-right: 3px; white-space: nowrap; }
.lab.w { background: #1d3c8c; } .lab.h { background: #7b3fa0; }
.lab.y { background: #2e7d32; } .lab.l { background: #c77700; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 14px; font-size: 10pt; }
.grid3 b { color: #1d3c8c; }
.lines { height: var(--h); background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 7.2mm, #999 7.2mm, #999 7.5mm); margin: 2px 0 6px; }
.sheet h3 { margin-top: 7px; }
.sheet table td { height: 9.5mm; }
.qt { color: #1d3c8c; }
</style>"""

BODY = STYLE + """
<h1>Poetry Toolkit</h1>
<div class="meta">Cambridge IGCSE Literature in English 0475 &middot; Paper 1, poetry question &middot;
Use this with the booklet for each set poem</div>

<h2>1 &nbsp;How the poetry question works</h2>
<ul>
<li>Paper 1 is <b>poetry and prose</b>: you answer one question on your poetry set texts and one on
your prose text. That gives you about <b>45 minutes</b> for the poetry answer.</li>
<li>Each poetry question is on <b>one named poem</b>, and the poem is printed in the paper (check this
with your teacher). So you don&rsquo;t need to memorise poems word for word &mdash; you need to know each one
well enough to analyse it confidently straight away.</li>
<li>You usually get a choice of two poems from your group.</li>
</ul>

<div class="box exam"><span class="lbl">Typical question wording</span>
&ldquo;How does the poet <b>vividly</b> convey &hellip;?&rdquo; &middot; &ldquo;In what ways does the poet
make &hellip; so <b>moving</b>?&rdquo; &middot; &ldquo;Explore how the poet creates a <b>powerful</b> sense of
&hellip;&rdquo; &middot; &ldquo;How does the poet&rsquo;s writing make &hellip; so <b>memorable</b>?&rdquo;<br>
The word in bold is the heart of the question. <span class="hl">Every paragraph must say how the writing
makes it vivid / moving / powerful / memorable.</span></div>

<h3>What the examiner rewards (assessment objectives, in plain words)</h3>
<table class="k">
<tr><th style="width:22%">AO</th><th>What it means for you</th></tr>
<tr><td>AO1 Knowledge</td><td>You know the poem and back up every point with short quotations.</td></tr>
<tr><td>AO2 Understanding</td><td>You go beyond what happens to the <b>ideas and attitudes</b> underneath
&mdash; what the poem is really saying.</td></tr>
<tr><td>AO3 Writer&rsquo;s methods</td><td><b>How</b> language, structure and form create meaning and effects.
This is the core of a poetry answer.</td></tr>
<tr><td>AO4 Personal response</td><td>Your own informed judgement: what you find powerful and why,
including other possible readings.</td></tr>
</table>
<p class="small">Higher marks go to answers that are detailed, sensitive and sustained all the way through.
Lower marks go to answers that retell the poem or just spot features.</p>

<h2>2 &nbsp;The 45-minute method</h2>
<table class="k">
<tr><th style="width:16%">Time</th><th>Do this</th></tr>
<tr><td>3 min</td><td><b>Read the question.</b> Underline the focus (what it asks about) and the key word
(vividly, movingly&hellip;).</td></tr>
<tr><td>7 min</td><td><b>Read the poem twice.</b> First for meaning: who is speaking, to whom, what situation,
how it changes from start to end. Second with a pen: mark 6&ndash;8 moments that answer the question.</td></tr>
<tr><td>3 min</td><td><b>Plan</b> 3&ndash;4 points. Following the poem from beginning to end is the
easiest way to stay organised and to make sure you reach the ending.</td></tr>
<tr><td>30 min</td><td><b>Write:</b> a 2&ndash;3 sentence intro (what the poem is about + your direct
answer to the question), 3&ndash;4 analytical paragraphs, then a short conclusion with your personal
response.</td></tr>
<tr><td>2 min</td><td><b>Check</b> that every paragraph uses the question&rsquo;s key word or idea.</td></tr>
</table>

<h3>Paragraph formula: What &rarr; How &rarr; Why</h3>
<table class="k">
<tr><td style="width:16%"><span class="lab w">WHAT</span></td><td>A point that answers the question (not
&ldquo;in stanza 2&hellip;&rdquo;).</td></tr>
<tr><td><span class="lab h">HOW</span></td><td>A short quotation (1&ndash;6 words) built into your sentence,
and the method used.</td></tr>
<tr><td><span class="lab y">WHY</span></td><td>The effect. Zoom in on one word &mdash; its connotations
&mdash; then zoom out to the bigger meaning. Offer another reading if you can.</td></tr>
<tr><td><span class="lab l">LINK</span></td><td>Tie it back to the question&rsquo;s key word.</td></tr>
</table>

<div class="keep">
<h3>Model paragraph</h3>
<p class="small">Question: How does Shakespeare make his praise of the beloved so memorable in Sonnet 18?</p>
<div class="para">
<span class="lab w">WHAT</span> Shakespeare makes his praise memorable by suggesting that even a perfect summer
falls short of the beloved.
<span class="lab h">HOW</span> The opening rhetorical question, <span class="qt">&lsquo;Shall I compare thee to a
summer&rsquo;s day?&rsquo;</span>, sets up a conventional compliment, but the speaker immediately turns it
around: the beloved is <span class="qt">&lsquo;more lovely and more temperate&rsquo;</span>.
<span class="lab y">WHY</span> The word &lsquo;temperate&rsquo; suggests calm and balance, which summer lacks:
its <span class="qt">&lsquo;Rough winds do shake the darling buds of May&rsquo;</span>. The harsh verb
&lsquo;shake&rsquo; threatens the tender, affectionate &lsquo;darling buds&rsquo;, so summer seems to damage the
very beauty it is famous for.
<span class="lab l">LINK</span> By overturning the expected comparison, Shakespeare makes his praise feel
original and striking: the beloved is not just like the best thing in nature, but better than it.
</div>
</div>

<h2>3 &nbsp;Techniques &mdash; and what to say about them</h2>
<p>Naming a technique earns nothing on its own. The last column is what turns it into marks.</p>

<h3>Language and imagery</h3>
<table class="tech">
<thead><tr><th>Technique</th><th>What it is</th><th>Example</th><th>What to say about it</th></tr></thead>
<tr><td>Imagery</td><td>Words that create a picture or appeal to the senses</td><td>the cold blue light of
morning</td><td>What mood does the picture create? Which sense, and why that one?</td></tr>
<tr><td>Simile</td><td>Comparison using <i>like</i> or <i>as</i></td><td>her voice like broken
glass</td><td>Which qualities carry over? (sharp, painful, fragile)</td></tr>
<tr><td>Metaphor</td><td>Saying something <i>is</i> something else</td><td>the city is a cage</td>
<td>More forceful than a simile &mdash; what does the comparison reveal? (trapped, controlled)</td></tr>
<tr><td>Extended metaphor</td><td>One metaphor developed over several lines or the whole poem</td>
<td>love as a long journey</td><td>Shows how the idea dominates the speaker&rsquo;s thinking; track how it
changes.</td></tr>
<tr><td>Personification</td><td>Giving human qualities to something non-human</td><td>the wind howled its
grief</td><td>Makes nature/objects seem alive, often mirroring the speaker&rsquo;s feelings.</td></tr>
<tr><td>Pathetic fallacy</td><td>Weather or setting reflecting emotion</td><td>rain wept on the empty
street</td><td>The world seems to share the mood &mdash; intensifies it.</td></tr>
<tr><td>Symbol</td><td>An object standing for an idea</td><td>a locked door</td><td>What idea does it stand
for here? (rejection, loss, secrecy)</td></tr>
<tr><td>Semantic field</td><td>A group of words from one topic</td><td>battle, wounds, surrender &mdash; in a
love poem</td><td>Shows what the speaker associates with the subject (love = conflict).</td></tr>
<tr><td>Connotations</td><td>Ideas a word suggests beyond its literal meaning</td><td>home &rarr; safety,
warmth</td><td>The best way to &ldquo;zoom in&rdquo;: pick one word and unpack it.</td></tr>
<tr><td>Juxtaposition</td><td>Two contrasting things placed close together</td><td>children laughing beside
a grave</td><td>Highlights the contrast; often creates shock or irony.</td></tr>
<tr><td>Oxymoron</td><td>Two opposite words together</td><td>sweet sorrow</td><td>Shows conflicted,
mixed feelings.</td></tr>
<tr><td>Paradox</td><td>A statement that seems contradictory but holds a truth</td><td>the more I own, the
less I have</td><td>Makes the reader stop and think about a deeper idea.</td></tr>
<tr><td>Hyperbole</td><td>Deliberate exaggeration</td><td>I&rsquo;ve waited a thousand years</td><td>Shows
the intensity of feeling &mdash; or mocks, if used ironically.</td></tr>
<tr><td>Irony</td><td>Gap between what&rsquo;s said and what&rsquo;s meant, or between expectation and
reality</td><td>&ldquo;What a lovely day&rdquo; in a storm</td><td>Reveals bitterness, criticism or
humour.</td></tr>
<tr><td>Direct address / &ldquo;you&rdquo;</td><td>Speaking straight to someone</td><td>You never asked me
why</td><td>Intimate, accusing or involving the reader &mdash; which one here?</td></tr>
<tr><td>Apostrophe</td><td>Addressing someone absent or dead, or an object/idea</td><td>O river, carry me
home</td><td>Shows longing or desperation; the listener can&rsquo;t answer.</td></tr>
<tr><td>Rhetorical question</td><td>A question not expecting an answer</td><td>What else could I have
done?</td><td>Shows doubt, anger or guilt; makes the reader reflect.</td></tr>
<tr><td>Imperative</td><td>A command</td><td>Remember me.</td><td>Urgency, authority or desperation.</td></tr>
<tr><td>Tone</td><td>The attitude of the voice</td><td>bitter, tender, nostalgic</td><td>Never just
name it &mdash; say which words create it, and where it shifts.</td></tr>
<tr><td>Diction / register</td><td>Word choice; how formal or casual</td><td>slang vs. formal, old-fashioned
words</td><td>What does the voice&rsquo;s style tell us about the speaker?</td></tr>
</table>

<h3>Sound</h3>
<table class="tech">
<thead><tr><th>Technique</th><th>What it is</th><th>Example</th><th>What to say about it</th></tr></thead>
<tr><td>Alliteration</td><td>Same consonant sound starting nearby words</td><td>cold, cruel coast</td>
<td>Say <b>which</b> sound and its effect: hard &lsquo;c/k&rsquo; sounds harsh; soft &lsquo;f/l&rsquo;
gentle.</td></tr>
<tr><td>Sibilance</td><td>Repeated &lsquo;s&rsquo; / &lsquo;sh&rsquo; sounds</td><td>the sea&rsquo;s soft
sighing</td><td>Soothing and whispering &mdash; or hissing and sinister. Which one here?</td></tr>
<tr><td>Plosives</td><td>Repeated p, b, t, d, k, g</td><td>bombs burst</td><td>Explosive, violent or
angry.</td></tr>
<tr><td>Assonance</td><td>Repeated vowel sounds</td><td>the low moan of the old road</td><td>Long vowels
slow the line &mdash; mournful, heavy.</td></tr>
<tr><td>Onomatopoeia</td><td>A word that sounds like its meaning</td><td>crack, hiss, murmur</td>
<td>Makes the moment vivid &mdash; you hear it.</td></tr>
<tr><td>Rhyme scheme</td><td>Pattern of end rhymes (ABAB&hellip;)</td><td>&mdash;</td><td>Regular rhyme:
order, control, song-like. Broken rhyme: disorder. Half-rhyme (soul/all): something slightly wrong or
unresolved.</td></tr>
<tr><td>Rhythm / metre</td><td>Pattern of stressed syllables</td><td>iambic pentameter: da-DUM &times; 5</td>
<td>Regular rhythm can feel like a heartbeat, a march or a chant. A break in the rhythm draws attention to
that moment.</td></tr>
<tr><td>Repetition / anaphora / refrain</td><td>Repeated words; repeated line openings; a repeated
line</td><td>Again I &hellip; / Again I &hellip;</td><td>Emphasis, obsession, chant-like build-up.</td></tr>
<tr><td>Listing, asyndeton, polysyndeton</td><td>Lists; no &ldquo;and&rdquo;s; lots of
&ldquo;and&rdquo;s</td><td>and rain and mud and cold</td><td>Overwhelming, breathless, piling up.</td></tr>
</table>

<h3>Structure</h3>
<table class="tech">
<thead><tr><th>Technique</th><th>What it is</th><th>Example</th><th>What to say about it</th></tr></thead>
<tr><td>Caesura</td><td>A pause in the middle of a line (punctuation)</td><td>I called. No answer.</td>
<td>Hesitation, shock, a break in thought; emphasises the words either side.</td></tr>
<tr><td>Enjambment</td><td>A sentence running over the end of a line</td><td>&mdash;</td><td>Speed, overflowing
emotion, thoughts that can&rsquo;t be contained; puts weight on the first word of the next line.</td></tr>
<tr><td>End-stopped line</td><td>A line ending with punctuation</td><td>&mdash;</td><td>Control,
finality, calm.</td></tr>
<tr><td>Stanzas</td><td>The &ldquo;paragraphs&rdquo; of a poem</td><td>&mdash;</td><td>Regular stanzas:
order. Irregular: chaos. What changes from one stanza to the next?</td></tr>
<tr><td>Volta</td><td>A turning point in argument or tone</td><td>But&hellip; / Yet&hellip;</td><td>A change
of perspective &mdash; always comment on it.</td></tr>
<tr><td>Cyclical structure</td><td>Ending where it began</td><td>&mdash;</td><td>Trapped, nothing has
changed &mdash; or a sense of completeness.</td></tr>
<tr><td>Short line / single-line stanza</td><td>A line that stands apart</td><td>&mdash;</td><td>Isolation,
emphasis, a moment of shock.</td></tr>
<tr><td>Shifts</td><td>Changes in tense, pronoun or tone</td><td>past &rarr; present; &ldquo;I&rdquo;
&rarr; &ldquo;we&rdquo;</td><td>Shows the speaker&rsquo;s understanding or feeling changing.</td></tr>
<tr><td>Title, opening, ending</td><td>&mdash;</td><td>&mdash;</td><td>Always comment on the ending: it is
where the poem makes its final point.</td></tr>
</table>

<h3>Form</h3>
<table class="tech">
<thead><tr><th>Form</th><th>What it is</th><th>Clue</th><th>What to say about it</th></tr></thead>
<tr><td>Sonnet</td><td>14 lines, traditionally about love. Shakespearean: 3 quatrains + a rhyming couplet.
Petrarchan: 8 lines + 6, turning at line 9.</td><td>14 lines</td><td>Is the poet using the love form
straight, or for a different subject (grief, war)? Where is the volta?</td></tr>
<tr><td>Dramatic monologue</td><td>A character (not the poet) speaks to a silent listener</td><td>&ldquo;you&rdquo;
who never replies</td><td>The speaker often reveals more about themselves than they intend.</td></tr>
<tr><td>Free verse</td><td>No regular rhyme or metre</td><td>&mdash;</td><td>Natural speech, freedom &mdash;
or unpredictability and disorder.</td></tr>
<tr><td>Ballad</td><td>Tells a story in regular, song-like stanzas</td><td>4-line stanzas, rhyme</td><td>Simple,
memorable &mdash; can make a tragic story feel like a folk tale.</td></tr>
<tr><td>Elegy</td><td>A poem mourning someone who has died</td><td>&mdash;</td><td>Grief, remembrance;
does it move towards comfort?</td></tr>
<tr><td>Ode</td><td>A poem of praise addressed to something</td><td>&ldquo;To&hellip;&rdquo;</td><td>Admiration,
celebration &mdash; is it sincere?</td></tr>
<tr><td>Lyric</td><td>A short poem of personal feeling</td><td>&mdash;</td><td>Intimate, emotional.</td></tr>
<tr><td>Blank verse</td><td>Unrhymed iambic pentameter</td><td>&mdash;</td><td>Serious and dignified, but
close to natural speech.</td></tr>
</table>

<h2>4 &nbsp;Phrase bank</h2>
<div class="row">
<div class="box def"><span class="lbl">Instead of &ldquo;shows&rdquo;</span>
suggests &middot; implies &middot; conveys &middot; evokes &middot; reveals &middot; emphasises &middot;
highlights &middot; reinforces &middot; intensifies &middot; foreshadows &middot; mirrors &middot; contrasts
with &middot; undermines &middot; creates a sense of</div>
<div class="box def"><span class="lbl">Zooming in</span>
&ldquo;The word &lsquo;X&rsquo; is especially powerful because&hellip;&rdquo;<br>
&ldquo;Its connotations of &hellip; suggest&hellip;&rdquo;<br>
&ldquo;The harsh / gentle sound of &hellip; mirrors&hellip;&rdquo;</div>
</div>

<h3>Words for tone</h3>
<div class="grid3">
<div><b>Positive</b><br>tender &middot; affectionate &middot; reverent &middot; joyful &middot; celebratory &middot;
awed &middot; hopeful &middot; nostalgic &middot; wistful</div>
<div><b>Negative</b><br>bitter &middot; resentful &middot; despairing &middot; mournful &middot; melancholic
&middot; sombre &middot; menacing &middot; sinister &middot; contemptuous &middot; sardonic</div>
<div><b>Other</b><br>reflective &middot; detached &middot; ironic &middot; ambivalent &middot; playful &middot;
defiant &middot; urgent &middot; conversational &middot; intimate &middot; matter-of-fact</div>
</div>

<div class="row" style="margin-top:6px">
<div class="box exam"><span class="lbl">Other readings (AO4)</span>
&ldquo;Perhaps&hellip;&rdquo; &middot; &ldquo;This could also suggest&hellip;&rdquo; &middot; &ldquo;A darker
reading is that&hellip;&rdquo; &middot; &ldquo;On the surface &hellip;, but underneath &hellip;&rdquo;</div>
<div class="box exam"><span class="lbl">Personal response (AO4)</span>
&ldquo;What I find most striking is&hellip;&rdquo; &middot; &ldquo;The final image is particularly moving
because&hellip;&rdquo; &middot; &ldquo;The poem leaves the reader feeling&hellip;&rdquo;</div>
</div>

<h2>5 &nbsp;Mistakes that cost marks</h2>
<div class="box warn"><span class="lbl">Watch out</span>
<ul>
<li><b>Feature spotting:</b> &ldquo;There is alliteration in line 3.&rdquo; Only name a technique if you
explain its effect.</li>
<li><b>Retelling the poem</b> instead of explaining <i>how</i> the writing works.</li>
<li><b>Forgetting the question&rsquo;s key word</b> (vividly, movingly&hellip;).</li>
<li><b>Empty effects:</b> &ldquo;makes the reader want to read on&rdquo;, &ldquo;makes it flow&rdquo;,
&ldquo;makes the reader think&rdquo;. Say exactly what the reader feels or understands.</li>
<li><b>Long quotations.</b> Quote 1&ndash;6 words and build them into your sentence.</li>
<li><b>&ldquo;The poet says&hellip;&rdquo;</b> Say &ldquo;the speaker&rdquo; unless the poem is clearly
about the poet&rsquo;s own life.</li>
<li><b>Running out of time before the ending.</b> The ending usually holds the poem&rsquo;s main
point.</li>
<li><b>Context bolted on</b> that doesn&rsquo;t help answer the question.</li>
</ul></div>

<div class="sheet" style="break-before: page">
<h2>Blank poem sheet <span class="small" style="font-weight:400">(photocopy one per poem)</span></h2>
<table class="k" style="margin-bottom:2px">
<tr><td style="width:18%">Poem</td><td></td><td style="width:14%">Poet</td><td style="width:30%"></td></tr>
</table>
<h3>In one sentence: what is it about?</h3><div class="lines" style="--h:16mm"></div>
<h3>Speaker &middot; who to &middot; situation</h3><div class="lines" style="--h:16mm"></div>
<h3>How it moves: start &rarr; middle &rarr; end (where&rsquo;s the turn?)</h3><div class="lines" style="--h:23mm"></div>
<div class="row">
<div><h3>Tone(s)</h3><div class="lines" style="--h:16mm"></div></div>
<div><h3>Themes</h3><div class="lines" style="--h:16mm"></div></div>
</div>
<h3>Key quotations</h3>
<table>
<tr><th style="width:34%">Quote (1&ndash;6 words)</th><th style="width:20%">Method</th><th>Effect &mdash; zoom in on a word</th></tr>
<tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr>
<tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr>
</table>
<h3>Form and structure</h3><div class="lines" style="--h:16mm"></div>
<h3>Likely question &mdash; &ldquo;How does the poet vividly / movingly &hellip;?&rdquo;</h3><div class="lines" style="--h:16mm"></div>
</div>
"""

if __name__ == "__main__":
    out = ROOT / "literature" / "Poetry Toolkit.pdf"
    preview = sys.argv[1] if len(sys.argv) > 1 else None
    render(TITLE, BODY, out, preview_dir=preview)
